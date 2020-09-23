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
  bcrypt.genSalt(12, (err, salt) => {
    if (err) {
      console.err(err);
    } else {
      bcrypt.hash(password, salt, (err, hash) => {
        if (err) {
          console.err(err);
        } else {
          console.log(hash);
        }
      });
    }
  });

  rl.close();
});
