import express, { Request, Response, Router } from 'express';
import basicAuth from 'express-basic-auth';
import bodyParser from 'body-parser';
import Shortener from './Shortener';
import Authenticator from './Authenticator';
import logger from './logger';
import { ResultObj } from './types';

export default class API {
  // The shortener interface
  private shortener: Shortener;

  // The authenticator interface
  private authenticator: Authenticator;

  // The router to serve all API calls
  private router: Router;

  constructor(shortener: Shortener, authenticator: Authenticator) {
    this.shortener = shortener;
    this.authenticator = authenticator;
    this.router = express.Router();
    this.asyncAuthorizer = this.asyncAuthorizer.bind(this);
    this.setupRouter();
  }

  private setupRouter() {
    this.router.use(bodyParser.json());
    this.router.use(basicAuth({
      authorizer: this.asyncAuthorizer,
      authorizeAsync: true,
    }));

    /**
     * POST to register new original: short pair.
     */
    this.router.post('/shorten', (req: Request, res: Response) => {
      const original = req.body.original || '';
      const short = req.body.short || this.shortener.makeShort();
      logger.info(`Validating ${short}: ${original}`);

      const result: ResultObj = this.shortener.validateInput(original, short);
      if (!result.success) {
        logger.warn(result.output);
      } else {
        this.shortener.set(short, original);
        logger.success('Succeeded in creating short');
      }

      res.json(result);
    });
  }

  private asyncAuthorizer(username: string, password: string, cb: Function) {
    this.authenticator.authenticate(username, password)
      .then(authorized => cb(null, authorized))
      .catch(() => cb(null, false));
  }

  getRouter() {
    return this.router;
  }
}