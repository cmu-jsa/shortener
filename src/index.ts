/**
 * Copyright 2019 - 2021
 * Japanese Student Association at Carnegie Mellon University.
 * All rights reserved. MIT license.
 */

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
import Users from './Users';
import DenyList from './DenyList';

/**
 * Environment Variables
 */
dotenv.config();
const url: string = process.env.ROOT_URL || 'http://localhost:5000';
const port: string = process.env.PORT || '5000';
const redisURL: string = process.env.REDIS_URL || '';
const nodeEnv: string = process.env.NODE_ENV || 'production';

/**
 * App settings
 */
const app: Application = express();
const db: RedisClient = redis.createClient(redisURL);
const denyList = new DenyList(db);
const shortener = new Shortener(db, denyList);
const users = new Users(db);
const api = new API(shortener, users).getRouter();
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
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  store: new RedisStore({
    client: db,
  }),
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 365 * 24 * 60 * 60 * 1000, // a year
  },
}));

/**
 * Custom middleware
 */
function requireHttps(req: Request, res: Response, next: NextFunction) {
  if (nodeEnv !== 'debug' && !req.secure) {
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
  // @ts-ignore
  const { username } = req.session;
  users.checkMembership(username)
    .then((membership) => {
      const { isMember } = membership;
      if (!isMember) {
        res.render('login', { secure: req.secure });
      } else {
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
          shortener.set(short, original, username);
          logger.success('Succeeded in creating short');
          res.render('index', {
            original,
            short,
            secure: req.secure,
          });
        }
      }
    })
    .catch(() => {
      res.render('login', { secure: req.secure });
    });
});

/**
 * GET admin portal.
 * Will return login page if not logged in.
 */
app.get('/admin', (req: Request, res: Response) => {
  // @ts-ignore
  const { username, adminSuccess, adminError } = req.session;
  // @ts-ignore
  req.session.adminSuccess = undefined;
  // @ts-ignore
  req.session.adminError = undefined;
  users.checkMembership(username)
    .then((result) => {
      const { isMember, isAdmin } = result;
      if (!isMember) {
        res.render('login', { secure: req.secure });
      } else {
        shortener.getAll()
          .then(async (shorts: LinkData[]) => {
            // Sort based on number of views
            // eslint-disable-next-line arrow-body-style
            shorts.sort((a: LinkData, b: LinkData) => {
              return parseInt(a.views, 10) >= parseInt(b.views, 10) ? -1 : 1;
            });

            res.render('admin', {
              shorts,
              isAdmin,
              secure: req.secure,
              denyList: denyList.getList(),
              username,
              adminSuccess,
              adminError,
              users: await users.listAll(),
            });
          })
          .catch((err: Error) => {
            logger.error('Redis error in /admin', err);
            res.render('admin', {
              secure: req.secure,
              adminError: 'Something went wrong',
            });
          });
      }
    })
    .catch(() => {
      res.render('admin', { secure: req.secure });
    });
});

/**
 * POST admin to check if login credentials match.
 */
app.post('/admin/login', requireHttps, (req: Request, res: Response) => {
  const {
    username,
    password,
  } = req.body;
  users.authenticate(username, password, true)
    .then((authenticatedAdmin) => {
      if (authenticatedAdmin) {
        // @ts-ignore
        req.session.username = username;
        res.redirect('/admin');
      } else {
        users.authenticate(username, password, false)
          .then((authenticatedUser) => {
            if (authenticatedUser) {
              // @ts-ignore
              req.session.username = username;
              res.redirect('/admin');
            } else {
              res.redirect('/admin');
            }
          })
          .catch((e) => {
            logger.error('Authentication failed unexpectedly', e);
            res.redirect('/admin');
          });
      }
    })
    .catch((e) => {
      logger.error('Authentication failed unexpectedly', e);
      res.redirect('/admin');
    });
});

/**
 * POST to update user password.
 */
app.post('/admin/password/update', requireHttps, (req: Request, res: Response) => {
  // @ts-ignore
  const { username } = req.session;
  const {
    oldPassword,
    newPassword,
    confirmPassword,
  } = req.body;
  const successMessage = 'Updated password';
  const errorMessage = 'Couldn\'t update password';
  if (
    newPassword !== ''
    && newPassword !== oldPassword
    && newPassword === confirmPassword
  ) {
    users.checkMembership(username)
      .then((result) => {
        const { isMember, isAdmin } = result;
        if (!isMember) {
          // @ts-ignore
          req.session.adminError = errorMessage;
          res.redirect('/admin');
        } else {
          users.updatePassword(username, oldPassword, newPassword, isAdmin)
            .then((updated) => {
              if (!updated) {
                // @ts-ignore
                req.session.adminError = errorMessage;
                logger.warn(`Couldn't update password for ${username}`);
              } else {
                // @ts-ignore
                req.session.adminSuccess = successMessage;
                logger.success(`Updated password for ${username}`);
              }

              res.redirect('/admin');
            })
            .catch(() => {
              // @ts-ignore
              req.session.adminError = errorMessage;
              res.redirect('/admin');
            });
        }
      })
      .catch(() => {
        // @ts-ignore
        req.session.adminError = errorMessage;
        res.redirect('/admin');
      });
  } else {
    // @ts-ignore
    req.session.adminError = errorMessage;
    res.redirect('/admin');
  }
});

/**
 * POST to remove a short: original pair from db.
 */
app.post('/admin/short/remove', requireHttps, (req: Request, res: Response) => {
  // Check if the user is logged in as admin
  // @ts-ignore
  users.checkMembership(req.session.username)
    .then((result) => {
      if (result.isAdmin) {
        shortener.del(req.body.short);
      }
    });

  res.redirect('/admin');
});

/**
 * POST to add a denyList keyword
 */
app.post('/admin/denyList/add', requireHttps, (req: Request, res: Response) => {
  // Check if the user is logged in as admin
  // @ts-ignore
  users.checkMembership(req.session.username)
    .then((result) => {
      if (result.isAdmin) {
        denyList.add(req.body.keyword);
      }
    });

  res.redirect('/admin');
});

/**
 * POST to remove a denyList keyword
 */
app.post('/admin/denyList/remove', requireHttps, (req: Request, res: Response) => {
  // Check if the user is logged in as admin
  // @ts-ignore
  users.checkMembership(req.session.username)
    .then((result) => {
      if (result.isAdmin) {
        denyList.rem(req.body.keyword);
      }
    });

  res.redirect('/admin');
});

/**
 * POST to reset a password
 */
app.post('/admin/users/resetPassword', requireHttps, async (req: Request, res: Response) => {
  // Check if the user is logged in as admin
  // @ts-ignore
  const result = await users.checkMembership(req.session.username);
  if (result.isAdmin) {
    users.resetPassword(req.body.username, req.body.role);
  }

  res.redirect('/admin');
});

/**
 * POST to remove a user
 */
app.post('/admin/users/removeUser', requireHttps, async (req: Request, res: Response) => {
  // Check if the user is logged in as admin
  // @ts-ignore
  const result = await users.checkMembership(req.session.username);
  if (result.isAdmin) {
    users.removeMember(req.body.username, req.body.role);
  }

  res.redirect('/admin');
});

/**
 * POST to register a user
 */
app.post('/admin/users/registerUser', requireHttps, async (req: Request, res: Response) => {
  // Check if the user is logged in as admin
  // @ts-ignore
  const result = await users.checkMembership(req.session.username);
  if (result.isAdmin) {
    const { username, tempPassword, isAdmin } = req.body;
    if (username) {
      await users.addNewMember(
        username,
        tempPassword,
        isAdmin === 'on',
      );
    }
  }

  res.redirect('/admin');
});

/**
 * POST to log out.
 */
app.post('/admin/logout', requireHttps, (req: Request, res: Response) => {
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
  logger.info(`node_env: ${nodeEnv}`);
});
