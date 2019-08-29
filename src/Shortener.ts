/**
 * Node built-in
 */
import { promisify } from 'util';

/**
 * Node modules
 */
import { RedisClient } from 'redis';
import randomstring from 'randomstring';

/**
 * Custom modules
 */
import logger from './logger';

/**
 * Types
 */
import { RedisDataObject, LinkData } from './types';

/**
 * A RedisClient db interface for shortener specific operations.
 */
export default class Shortener {
  // The redis database client to work off.
  private db: RedisClient;

  // Stores all generated shorts for quick ref.
  private generatedShorts: Set<string>;

  // Declaring original hget wrapper for promisify.
  private hget: Function;

  // Declaring original hgetall wrapper for promisify.
  private hgetall: Function;

  /**
   * Constructs a db interface for url shortening operations.
   */
  constructor(db: RedisClient) {
    this.db = db;
    this.hget = promisify(db.hget).bind(db);
    this.hgetall = promisify(db.hgetall).bind(db);
    this.generatedShorts = new Set();
    this.populateGeneratedShorts()
      .then(() => logger.success('Successfully populated set from db'))
      .catch(err => logger.error('Could not populate set from db', err));
  }

  /**
   * Populates this.generatedShorts by reading entries in db.
   */
  private async populateGeneratedShorts() {
    const data = await this.hgetall('s');
    Object.keys(data).forEach((short: string) => {
      this.generatedShorts.add(short);
    });
  }

  /**
   * Returns whether the short already exists or not.
   */
  has(short: string): boolean {
    return this.generatedShorts.has(short);
  }

  /**
   * Generates a random 5 letter string to use for shorts.
   * This is a recursive function...!
   */
  makeShort(): string {
    const randShort: string = randomstring.generate({
      length: 5,
      readable: true,
      charset: 'alphanumeric',
    });

    // Check if randShort is unique
    if (!this.has(randShort)) {
      return randShort;
    }

    return this.makeShort();
  }

  /**
   * Sets the short: original pair in the db.
   */
  set(short: string, original: string): void {
    this.db.hset('s', short, original);
    this.db.hset('v', short, '0');
    this.generatedShorts.add(short);
  }

  /**
   * Deletes the short from the db.
   */
  del(short: string): void {
    if (this.has(short)) {
      this.db.hdel('s', short);
      this.db.hdel('v', short);
      this.generatedShorts.delete(short);
    }
  }

  /**
   * Gets the short from the db.
   * If short doesn't exist in db, returns null.
   */
  async get(short: string): Promise<string> {
    return this.hget('s', short);
  }

  /**
   * Returns an array of LinkData stored in db.
   */
  async getAll(): Promise<LinkData[]> {
    const originals: RedisDataObject = await this.hgetall('s');
    const views: RedisDataObject = await this.hgetall('v');
    return Object.keys(originals).map((short: string) => ({
      short,
      original: originals[short],
      views: views[short],
    }));
  }

  /**
   * Increments the page view of a short by 1.
   */
  incr(short: string): void {
    this.db.hincrby('v', short, 1);
  }
}
