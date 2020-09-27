/**
 * Copyright 2019 - 2020
 * Japanese Student Association at Carnegie Mellon University.
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
import bcrypt from 'bcrypt';

export default class Users {
  // The redis database client to work off.
  private db: RedisClient;

  // Declaring original hget wrapper for promisify.
  private hget: Function;

  // Declaring original hset wrapper for promisify.
  private hset: Function;

  // Declaring original hexists wrapper for promisify.
  private hexists: Function;

  // Declaring original genSalt wrapper for promisify.
  private genSalt: Function;

  // Declaring original hash wrapper for promisify.
  private hash: Function;

  constructor(db: RedisClient) {
    this.db = db;
    this.hget = promisify(db.hget).bind(db);
    this.hset = promisify(db.hset).bind(db);
    this.hexists = promisify(db.hexists).bind(db);
    this.genSalt = promisify(bcrypt.genSalt).bind(bcrypt);
    this.hash = promisify(bcrypt.hash).bind(bcrypt);
  }

  async authenticate(username: string, password: string, admin = false) {
    const table = admin ? 'admin' : 'user';
    const realPassword = await this.hget(table, username);
    if (realPassword === null) {
      return false;
    }

    return bcrypt.compare(password, realPassword);
  }

  /**
   * Check if the username is registered as a legitimate user.
   */
  async checkMembership(username: string) {
    if (
      username === undefined
      || username === null
      || username === ''
    ) {
      return {
        isMember: false,
        isAdmin: false,
      };
    }

    const isAdmin = await this.hexists('admin', username);
    const isUser = await this.hexists('user', username);
    return {
      isMember: isAdmin || isUser,
      isAdmin,
    };
  }

  async updatePassword(username: string, oldPassword: string, newPassword: string, admin = false) {
    const authenticated = await this.authenticate(username, oldPassword, admin);
    if (authenticated) {
      const table = admin ? 'admin' : 'user';
      const salt = await this.genSalt(12);
      const newPasswordHash = await this.hash(newPassword, salt);
      this.hset(table, username, newPasswordHash);
      return true;
    }

    return false;
  }
}
