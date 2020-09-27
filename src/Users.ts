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

  // Declaring original hexists wrapper for promisify.
  private hexists: Function;

  constructor(db: RedisClient) {
    this.db = db;
    this.hget = promisify(db.hget).bind(db);
    this.hexists = promisify(db.hexists).bind(db);
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
    const isAdmin = await this.hexists('admin', username);
    const isUser = await this.hexists('user', username);
    return {
      isMember: isAdmin || isUser,
      isAdmin,
    };
  }

  // updatePassword(username: string, oldPassword: string, newPassword: string) {

  // }
}
