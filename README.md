# shortener
A simple url shortener for JSA members to use ♥️

## Installation

```sh
# Confirm node version >= 10.15.0
$ node -v

# Confirm yarn version >= 1.17.3
$ yarn -v

# Clone the repository
$ git clone https://github.com/cmu-jsa/shortener.git

# Enter the created directory
$ cd shortener

# Install dependencies
$ yarn
```

## Dev

Will run on http://localhost:5000

```sh
# Start db server
$ yarn db

# Start app server (in new tab)
$ yarn dev
```

Pre-push

```sh
# Build (Resolve any TypeScript errors)
$ yarn build

# Style check
$ yarn lint

# Run compiled JS
$ yarn start
```
