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
