/**
 * Copyright 2019 - 2020
 * Japanese Student Association at Carnegie Mellon University.
 * All rights reserved. MIT license.
 */

const bcrypt = require('bcrypt');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('What is the password? ', (password) => {
  bcrypt.genSalt(12, (err1, salt) => {
    if (err1) {
      console.err(err1);
    } else {
      bcrypt.hash(password, salt, (err2, hash) => {
        if (err2) {
          console.err(err2);
        } else {
          console.log(hash);
        }
      });
    }
  });

  rl.close();
});
