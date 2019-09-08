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
import express, { Application, Request, Response } from 'express';
import session from 'express-session';
import connectRedis from 'connect-redis';
import bodyParser from 'body-parser';
import redis, { RedisClient } from 'redis';
import validator from 'validator';
import isImage from 'is-image';

/**
 * Custom
 */
import logger from './logger';
import Shortener from './Shortener';

/**
 * Types
 */
import { LinkData } from './types';

/**
 * Environment Variables
 */
dotenv.config();
const url: string = process.env.ROOT_URL || 'http://localhost:5000';
const port: string = process.env.PORT || '5000';
const redisURL: string = process.env.REDIS_URL || '';
const adminUser: string = process.env.ADMIN_USER || '';
const adminPass: string = process.env.ADMIN_PASS || '';
const apiKey: string = process.env.API_KEY || '';

/**
 * App settings
 */
const app: Application = express();
const db: RedisClient = redis.createClient(redisURL);
const ShortDB = new Shortener(db);
const RedisStore = connectRedis(session);

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
 * Views
 */
app.set('view engine', 'ejs');
app.set('views', './views');

/**
 * Helpers
 */

/**
 * Validates the original and short pair.
 */
interface ResultObj {
  success: boolean;
  output: string;
}

function validateInput(original: string, short: string): ResultObj {
  const result = {
    success: true,
    output: `jsa.life/${short}`,
  };

  // Validate original URL.
  const urlOptions = {
    protocols: ['http', 'https'],
    require_protocol: true,
  };

  if (!validator.isURL(original, urlOptions)) {
    result.success = false;
    result.output = 'Invalid original URL';
  }

  // Validate short.
  if (!validator.isAlphanumeric(short.replace(/[_!-]/g, 'a'))) {
    result.success = false;
    result.output = `Cannot shorten to ${short}`;
  }

  // Check if short already exists.
  if (ShortDB.has(short)) {
    result.success = false;
    result.output = `${short} is already taken`;
  }

  return result;
}

/**
 * API routes
 */

/**
 * POST to register new original: short pair.
 */
app.get('/api/createShort', (req: Request, res: Response) => {
  // Check API Key
  if (req.query.apiKey !== apiKey) {
    res.json({
      success: false,
      output: 'Invalid API Key',
    })

  // API check passed
  } else {
    const original = req.query.o || '';
    const short = req.query.s || ShortDB.makeShort();
    logger.info(`Validating ${short}: ${original}`);

    const result: ResultObj = validateInput(original, short);
    if (!result.success) {
      logger.warn(result.output);
    } else {
      ShortDB.set(short, original);
      logger.success('Succeeded in creating short');
    }

    res.json(result);
  }
});

/**
 * Browser routes
 */

/**
 * GET home
 */
app.get('/', (req: Request, res: Response) => {
  res.render('index');
});

/**
 * POST to home to register new original: short pair.
 */
app.post('/', (req: Request, res: Response) => {
  const original = req.body.original || '';
  const short = req.body.short || ShortDB.makeShort();
  logger.info(`Validating ${short}: ${original}`);

  // Validates input first
  const result: ResultObj = validateInput(original, short);
  if (!result.success) {
    logger.warn(result.output);
    res.render('index', {
      error: result.output,
    });

  // All checks have passed
  } else {
    ShortDB.set(short, original);
    logger.success('Succeeded in creating short');
    res.render('index', {
      original,
      short,
    });
  }
});

/**
 * GET admin portal.
 * Will return login page if not logged in.
 */
app.get('/admin', (req: Request, res: Response) => {
  // @ts-ignore
  if (req.session.user !== adminUser) {
    res.render('login');
  } else {
    ShortDB.getAll()
      .then((data: LinkData[]) => {

        // Sort based on number of views
        data.sort((a: LinkData, b: LinkData) => {
          return parseInt(a.views, 10) >= parseInt(b.views, 10) ? -1 : 1;
        });
        res.render('admin', {
          data,
        });
      })
      .catch((err: Error) => {
        logger.error('Redis error in /admin', err);
        res.render('admin');
      });
  }
});

/**
 * POST admin to check if login credentials match.
 */
app.post('/admin', (req: Request, res: Response) => {
  const {
    username,
    password,
  } = req.body;
  if (username === adminUser && password === adminPass) {
    // @ts-ignore
    req.session.user = username;
    res.redirect('/admin');
  } else {
    res.render('login');
  }
});

/**
 * POST to remove a short: original pair from db.
 */
app.post('/remove', (req: Request, res: Response) => {
  // Check if the user is logged in properly
  // @ts-ignore
  if (req.session.user === adminUser) {
    const { short } = req.body;
    ShortDB.del(short);
  }

  res.redirect('/admin');
});

/**
 * POST to log out.
 */
app.post('/logout', (req: Request, res: Response) => {
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
  if (!ShortDB.has(short)) {
    logger.warn('No redirects found');
    res.redirect('/');
  } else {
    ShortDB.get(short)
      .then((original: string) => {
        logger.info(`Redirected to ${original}`);
        res.redirect(original);
        ShortDB.incr(short);
      })
      .catch((err: Error) => {
        logger.error('Redis error in /:short', err);
        res.render('index', {
          error: 'There was a DB error. Please contact rkhorana@alumni.cmu.edu',
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
      return res.render('404');
    }

    const images: string[] = files.filter(file => isImage(file));
    const randomIndex: number = Math.floor(Math.random() * images.length);
    const selectedImg: string = images[randomIndex];
    return res.render('404', {
      img: `/assets/404/${selectedImg}`,
    });
  });
});

/**
 * Listen
 */
app.listen(port, () => {
  logger.info(`Listening on port ${port}!`);
});
