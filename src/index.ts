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
 * GET home
 */
app.get('/', (req: Request, res: Response) => {
  res.render('index');
});

/**
 * POST to home to register new original: short pair.
 */
app.post('/', (req: Request, res: Response) => {
  const { original } = req.body;
  const short = req.body.short || ShortDB.makeShort();
  logger.info(`Checking ${short}: ${original}`);

  // Validate original URL.
  const urlOptions = {
    protocols: ['http', 'https'],
    require_protocol: true,
  };

  if (!validator.isURL(original, urlOptions)) {
    logger.warn('Original URL was invalid');
    return res.render('index', {
      error: 'Invalid URL',
    });
  }

  // Validate short.
  if (!validator.isAlphanumeric(short.replace(/[_!-]/g, ''))) {
    logger.warn('Short was invalid');
    return res.render('index', {
      error: `Cannot shorten to ${short}`,
    });
  }

  // Check if short already exists.
  if (ShortDB.has(short)) {
    logger.warn('Short already has a target');
    return res.render('index', {
      error: `${short} is already taken`,
    });
  }

  // All checks have passed.
  ShortDB.set(short, original);
  logger.success('Succeeded in creating short');
  return res.render('index', {
    original,
    short,
  });
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
        data.sort((a: LinkData, b: LinkData) => ((a.views >= b.views) ? -1 : 1));
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
