/**
 * Copyright 2019 - 2021
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

export type Role = 'admin' | 'user';

export interface UserInfo {
  username: string;
  role: Role;
}

export default class Users {
  // The redis database client to work off.
  private db: RedisClient;

  // Declaring original hget wrapper for promisify.
  private hget: Function;

  // Declaring original hgetall wrapper for promisify.
  private hgetall: Function;

  // Declaring original hset wrapper for promisify.
  private hset: Function;

  // Declaring original hset wrapper for promisify.
  private hdel: Function;

  // Declaring original hexists wrapper for promisify.
  private hexists: Function;

  // Declaring original genSalt wrapper for promisify.
  private genSalt: Function;

  // Declaring original hash wrapper for promisify.
  private hash: Function;

  constructor(db: RedisClient) {
    this.db = db;
    this.hget = promisify(db.hget).bind(db);
    this.hgetall = promisify(db.hgetall).bind(db);
    this.hset = promisify(db.hset).bind(db);
    this.hdel = promisify(db.hdel).bind(db);
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

  async resetPassword(username: string, role: Role) {
    if (role !== 'admin' && role !== 'user') {
      return;
    }

    const salt = await this.genSalt(12);
    const newPasswordHash = await this.hash('abcd', salt);
    this.hset(role, username, newPasswordHash);
  }

  async addNewMember(username: string, password: string, admin = false) {
    const table = admin ? 'admin' : 'user';
    const salt = await this.genSalt(12);
    const passwordHash = await this.hash(password, salt);
    this.hset(table, username, passwordHash);
  }

  removeMember(username: string, role: Role) {
    this.hdel(role, username);
  }

  async listAll() {
    const result: UserInfo[] = [];
    const admins = await this.hgetall('admin') || {};
    const users = await this.hgetall('user') || {};
    Object.keys(admins).forEach((username) => {
      result.push({
        username,
        role: 'admin',
      });
    });
    Object.keys(users).forEach((username) => {
      result.push({
        username,
        role: 'user',
      });
    });
    return result;
  }
}
