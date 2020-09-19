/**
 * Node built-in
 */
import fs from 'fs';
import path from 'path';
import http from 'http';

/**
 * Node modules
 */
import dotenv from 'dotenv';
import express, {
  Application,
  Request,
  Response,
  NextFunction,
} from 'express';
import session from 'express-session';
import connectRedis from 'connect-redis';
import bodyParser from 'body-parser';
import redis, { RedisClient } from 'redis';
import isImage from 'is-image';

/**
 * Custom
 */
import logger from './logger';
import Shortener from './Shortener';
import API from './API';

/**
 * Types
 */
import { LinkData, ResultObj } from './types';
import Authenticator from './Authenticator';

/**
 * Environment Variables
 */
dotenv.config();
const url: string = process.env.ROOT_URL || 'http://localhost:5000';
const port: string = process.env.PORT || '5000';
const redisURL: string = process.env.REDIS_URL || '';

/**
 * App settings
 */
const app: Application = express();
const db: RedisClient = redis.createClient(redisURL);
const shortener = new Shortener(db);
const authenticator = new Authenticator(db);
const api = new API(shortener, authenticator).getRouter();
const RedisStore = connectRedis(session);
app.enable('trust proxy');

/**
 * Fallback for database error
 */
db.on('error', (err: Error) => {
  logger.error('Redis error', err);
});

/**
 * Ping the website every 20 mins to avoid idle state
 * This is for heroku:
 *   https://devcenter.heroku.com/articles/free-dyno-hours
 */
setInterval(() => {
  logger.log('Ping site to prevent idle state');
  http.get(url);
}, 20 * 60 * 1000);

/**
 * Middleware
 */
app.use('/api', api);
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '../favicon')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  store: new RedisStore({
    client: db,
  }),
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 60 * 60 * 1000,
  },
}));

/**
 * Custom middleware
 */
function requireHttps(req: Request, res: Response, next: NextFunction) {
  if (!req.secure) {
    res.status(405).send('405 - https required');
  } else {
    next();
  }
}

/**
 * Views
 */
app.set('view engine', 'ejs');
app.set('views', './views');

/**
 * GET home
 */
app.get('/', (req: Request, res: Response) => {
  res.render('index', { secure: req.secure });
});

/**
 * POST to home to register new original: short pair.
 */
app.post('/', (req: Request, res: Response) => {
  const original = req.body.original || '';
  const short = req.body.short || shortener.makeShort();
  logger.info(`Validating ${short}: ${original}`);

  // Validates input first
  const result: ResultObj = shortener.validateInput(original, short);
  if (!result.success) {
    logger.warn(result.output);
    res.render('index', {
      error: result.output,
      secure: req.secure,
    });

  // All checks have passed
  } else {
    shortener.set(short, original);
    logger.success('Succeeded in creating short');
    res.render('index', {
      original,
      short,
      secure: req.secure,
    });
  }
});

/**
 * GET admin portal.
 * Will return login page if not logged in.
 */
app.get('/admin', (req: Request, res: Response) => {
  // @ts-ignore
  const { user } = req.session;
  if (user !== 'admin' && user !== 'user') {
    res.render('login', { secure: req.secure });
  } else {
    shortener.getAll()
      .then((data: LinkData[]) => {
        // Sort based on number of views
        // eslint-disable-next-line arrow-body-style
        data.sort((a: LinkData, b: LinkData) => {
          return parseInt(a.views, 10) >= parseInt(b.views, 10) ? -1 : 1;
        });
        res.render('admin', {
          data,
          isAdmin: user === 'admin',
          secure: req.secure,
        });
      })
      .catch((err: Error) => {
        logger.error('Redis error in /admin', err);
        res.render('admin', { secure: req.secure });
      });
  }
});

/**
 * POST admin to check if login credentials match.
 */
app.post('/admin', requireHttps, (req: Request, res: Response) => {
  const {
    username,
    password,
  } = req.body;
  authenticator.authenticate(username, password, true)
    .then((authenticatedAdmin) => {
      if (authenticatedAdmin) {
        // @ts-ignore
        req.session.user = 'admin';
        res.redirect('/admin');
      } else {
        authenticator.authenticate(username, password, false)
          .then((authenticatedUser) => {
            if (authenticatedUser) {
              // @ts-ignore
              req.session.user = 'user';
              res.redirect('/admin');
            } else {
              res.render('login');
            }
          })
          .catch((e) => {
            logger.error('Authentication failed unexpectedly', e);
            res.render('login');
          });
      }
    })
    .catch((e) => {
      logger.error('Authentication failed unexpectedly', e);
      res.render('login');
    });
});

/**
 * POST to remove a short: original pair from db.
 */
app.post('/remove', requireHttps, (req: Request, res: Response) => {
  // Check if the user is logged in as admin
  // @ts-ignore
  if (req.session.user === 'admin') {
    const { short } = req.body;
    shortener.del(short);
  }

  res.redirect('/admin');
});

/**
 * POST to log out.
 */
app.post('/logout', requireHttps, (req: Request, res: Response) => {
  if (req.session) {
    req.session.destroy((err: Error | null) => {
      if (err) {
        logger.error('Couldn\'t log out', err);
      }
    });
  }

  res.redirect('/admin');
});

/**
 * Redirect to original url if short is a valid key.
 * Redirect to home page if not.
 * Also logs the number of times the short was used.
 */
app.all('/:short', (req: Request, res: Response) => {
  const { short } = req.params;
  logger.info(`Trying to redirect from ${short}`);

  // Invalid short
  if (!shortener.has(short)) {
    logger.warn('No redirects found');
    res.redirect('/');
  } else {
    shortener.get(short)
      .then((original: string) => {
        logger.info(`Redirected to ${original}`);
        res.redirect(original);
        shortener.incr(short);
      })
      .catch((err: Error) => {
        logger.error('Redis error in /:short', err);
        res.render('index', {
          error: 'There was a DB error. Please contact rkhorana@alumni.cmu.edu',
          secure: req.secure,
        });
      });
  }
});

/**
 * 404 not found
 */
app.all('*', (req: Request, res: Response) => {
  const dirPath = path.join(__dirname, '../public/assets/404');
  fs.readdir(dirPath, (err, files) => {
    if (err) {
      return res.render('404', { secure: req.secure });
    }

    const images: string[] = files.filter(file => isImage(file));
    const randomIndex: number = Math.floor(Math.random() * images.length);
    const selectedImg: string = images[randomIndex];
    return res.render('404', {
      img: `/assets/404/${selectedImg}`,
      secure: req.secure,
    });
  });
});

/**
 * Listen
 */
app.listen(port, () => {
  logger.info(`Listening on port ${port}!`);
});
