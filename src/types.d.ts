/**
 * Copyright 2019 - 2021
 * Japanese Student Association at Carnegie Mellon University.
 * All rights reserved. MIT license.
 */

export type RedisDataObject = {[index: string]: string};

export interface LinkData {
  short: string;
  original: string;
  views: string;
  user: string;
}

export interface ResultObj {
  success: boolean;
  output: string;
}
