import { RedisClient } from 'redis';
import { promisify } from 'util';
import basicAuth from 'express-basic-auth';

export default class Authenticator {
  // The redis database client to work off.
  private db: RedisClient;

  // Declaring original hget wrapper for promisify.
  private hget: Function;

  constructor(db: RedisClient) {
    this.db = db;
    this.hget = promisify(db.hget).bind(db);
  }

  async authenticate(username: string, password: string, admin = false) {
    const table = admin ? 'admin' : 'user';
    const realPassword = await this.hget(table, username);
    if (realPassword === null) {
      return false;
    }

    return basicAuth.safeCompare(password, realPassword);
  }
}
