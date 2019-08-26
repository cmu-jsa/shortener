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
import bodyParser from 'body-parser';
import redis, { RedisClient } from 'redis';
import validator from 'validator';
import randomstring from 'randomstring';
import isImage from 'is-image';

/**
 * Custom
 */
import logger from './logger';

/**
 * Settings
 */
dotenv.config();
const app: Application = express();
const db: RedisClient = redis.createClient();
const url: string = process.env.ROOT_URL || 'http://localhost:5000';
const port: string = process.env.PORT || '5000';

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
 * Helper function to generate a random string.
 */
function generateShort(): string {
  return randomstring.generate({
    length: 5,
    readable: true,
    charset: 'alphanumeric',
  });
}

/**
 * POST to home to register new original: short pair.
 */
app.post('/', (req: Request, res: Response) => {
  const { original }: { original: string } = req.body;
  const short: string = req.body.short || generateShort();
  logger.info(`Checking ${original}: ${short}`);

  // Validate url
  const urlOptions = {
    protocols: ['http', 'https'],
    require_protocol: true,
  };

  if (!validator.isURL(original, urlOptions)) {
    logger.warn('Original URL was invalid');
    res.render('index', {
      error: 'Invalid URL!',
    });

  // Validate short
  } else if (!validator.isAlphanumeric(short.replace(/[_!-]/g, ''))) {
    logger.warn('Short was invalid');
    res.render('index', {
      error: `Cannot shorten to ${short}!`,
    });

  // Passed validator. Check for existence.
  } else {
    db.get(short, (err: Error | null, predecessor: string) => {
      // There was a DB error
      if (err) {
        logger.error('Redis error in /', err);
        res.render('index', {
          error: 'There was a DB error. Please contact rkhorana@alumni.cmu.edu',
        });

      // Original already existed
      } else if (predecessor) {
        logger.warn(`${short} already redirects to ${predecessor}`);
        res.render('index', {
          error: `${short} is already taken!`,
        });

      // Original didn't exist. Store in DB!
      } else {
        db.set(short, original);
        logger.success(`${short} now redirects to ${original}`);
        res.render('index', {
          original,
          short,
        });
      }
    });
  }
});

/**
 * Redirect to original url if short is a valid key.
 * Redirect to home page if not.
 */
app.all('/:short', (req: Request, res: Response) => {
  const { short } = req.params;
  logger.info(`Trying to redirect ${short}`);
  db.get(short, (err: Error | null, original: string) => {
    if (err) {
      logger.error('Redis error in /:short', err);
      res.render('index', {
        error: 'There was a DB error. Please contact rkhorana@alumni.cmu.edu',
      });
    } else if (original) {
      logger.info(`Redirected to ${original}`);
      res.redirect(original);
    } else {
      logger.warn('No redirects found');
      res.redirect('/');
    }
  });
});

/**
 * 404
 */
app.all('*', (req: Request, res: Response) => {
  const dirPath = path.join(__dirname, '../public/assets/404');
  fs.readdir(dirPath, (err, files) => {
    if (err) {
      res.render('404');
    } else {
      const images: string[] = files.filter(file => isImage(file));
      const randomIndex: number = Math.floor(Math.random() * images.length);
      const selectedImg: string = images[randomIndex];
      res.render('404', {
        img: `/assets/404/${selectedImg}`,
      });
    }
  });
});

/**
 * Listen
 */
app.listen(port, () => {
  logger.info(`Listening on port ${port}!`);
});
