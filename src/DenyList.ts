/**
 * Copyright 2019 - 2021 Japanese Student Association at Carnegie Mellon University.
 * All rights reserved. MIT license.
 */

/**
 * Node built-in
 */
import { promisify } from 'util';

/**
 * Node modules
 */
import { RedisClient } from 'redis';

/**
 * Custom modules
 */
import logger from './logger';

/**
 * A RedisClient db interface for denyList.
 */
export default class DenyList {
  // The redis database client to work off.
  private db: RedisClient;

  // Stores all denyList for quick ref.
  private denyList: Set<string>;

  // Declaring original sadd wrapper for promisify.
  private sadd: Function;

  // Declaring original srem wrapper for promisify.
  private srem: Function;

  // Declaring original smembers wrapper for promisify.
  private smembers: Function;

  /**
   * Constructs a db interface for url shortening operations.
   */
  constructor(db: RedisClient) {
    this.db = db;
    this.sadd = promisify(db.sadd).bind(db);
    this.srem = promisify(db.srem).bind(db);
    this.smembers = promisify(db.smembers).bind(db);
    this.denyList = new Set();
    this.populateDenyList()
      .then(() => logger.success('Successfully populated denyList from db'))
      .catch(err => logger.error('Could not populate denyList from db', err));
  }

  /**
   * Populates this.denyList by reading entries in db.
   */
  private async populateDenyList() {
    const data = await this.smembers('denyList');
    if (data != null) {
      data.forEach((deny: string) => {
        this.denyList.add(deny);
      });
    }
  }

  getList() {
    return Array.from(this.denyList);
  }

  async add(str: string) {
    if (str.length > 5) {
      await this.sadd('denyList', str);
      this.denyList.add(str);
    }
  }

  async rem(str: string) {
    await this.srem('denyList', str);
    this.denyList.delete(str);
  }
}
