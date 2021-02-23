# shortener
A simple url shortener for JSA members to use ♥️

# Using the API

In order to use the shortener API, you must acquire a username + password.
Please ask the code owner if you think you may need one.

## Request

### Base URL

You must use [https://jsa-life.herokuapp.com](https://jsa-life.herokuapp.com) as the base URL, since the APIs are only available through https.

### Header

- (Required) `Authorization: Basic ${BASE64_ENCODED_STRING}` - The API uses [basic authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication)
- (Required) `Content-Type: application/json`

### Body

Expects a JSON with the following fields:

- (Required) `original`: The original URL to be shortened
- (Optional) `short`: What goes in the * of the shortened jsa.life/* URL

## Response

All authenticated requests will be responded by a 200, with a response body:

- success: Boolean value of whether the URL was successfully shortened or not
- output: The shortened URL iff success == true, error message otherwise

## Example

Sample request:
```
curl -X POST 'https://jsa-life.herokuapp.com/api/shorten' --user '${YOUR_USER_NAME}' -H 'Content-Type:application/json' -d '{"original":"https://cmujsa.com","short":"home"}'
```

Sample response:
```json
{
  "success": true,
  "output": "jsa.life/home"
}
```

# Development

## Prerequisites

You must have the following available on your local machine:
- Node.js + npm
- redis (For mac users: `brew install redis`)

## Installation

```sh
# Confirm node version >= 10.15.0
$ node -v

# Clone the repository
$ git clone https://github.com/cmu-jsa/shortener.git

# Enter the created directory
$ cd shortener

# Install dependencies
$ npm i
```

## Dev

Will run on http://localhost:5000

```sh
# Start db server
$ npm run db

# Start app server (in new tab)
$ npm run dev
```

Pre-push

```sh
# Build (Resolve any TypeScript errors)
$ npm run build

# Style check
$ npm run lint

# Run compiled JS
$ npm start
```
