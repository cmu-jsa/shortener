/**
 * Copyright 2019 - 2021
 * Japanese Student Association at Carnegie Mellon University.
 * All rights reserved. MIT license.
 */

/**
 * Node modules
 */
import express, {
  Request,
  Response,
  Router,
  NextFunction,
} from 'express';
import basicAuth from 'express-basic-auth';
import cors from 'cors';

/**
 * Custom
 */
import Shortener from './Shortener';
import Users from './Users';
import logger from './logger';

/**
 * Types
 */
import { ResultObj } from './types';

export default class API {
  // The shortener interface
  private shortener: Shortener;

  // The users interface
  private users: Users;

  // The router to serve all API calls
  private router: Router;

  constructor(shortener: Shortener, users: Users) {
    this.shortener = shortener;
    this.users = users;
    this.router = express.Router();
    this.asyncAuthorizer = this.asyncAuthorizer.bind(this);
    this.setupRouter();
  }

  private setupRouter() {
    this.router.use(cors());
    this.router.use(express.json());
    this.router.use(basicAuth({
      authorizer: this.asyncAuthorizer,
      authorizeAsync: true,
      unauthorizedResponse: '401 - Unauthorized',
    }));

    /**
     * POST to register new original: short pair.
     */
    this.router.post('/shorten', API.requireHttps, (req: Request, res: Response) => {
      const original = req.body.original || '';
      const short = req.body.short || this.shortener.makeShort();
      // @ts-ignore
      logger.info(`Validating ${short}: ${original} by ${req.auth.user}`);

      const result: ResultObj = this.shortener.validateInput(original, short);
      if (!result.success) {
        logger.warn(result.output);
      } else {
        // @ts-ignore
        this.shortener.set(short, original, req.auth.user);
        logger.success('Succeeded in creating short');
      }

      res.json(result);
    });
  }

  private asyncAuthorizer(username: string, password: string, cb: Function) {
    this.users.authenticate(username, password)
      .then(authorized => cb(null, authorized))
      .catch(() => cb(null, false));
  }

  /**
   * Custom middleware
   */
  private static requireHttps(req: Request, res: Response, next: NextFunction) {
    if (!req.secure) {
      res.status(405).send('405 - https required');
    } else {
      next();
    }
  }

  getRouter() {
    return this.router;
  }
}
