# shortener
A simple url shortener for JSA members to use ♥️

# Use the API

In order to use the shortener API, you must acquire a username + password.
Please ask the code owner if you think you may need one.

## Request

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
- output: The shortened URL iff success == true

## Example

Sample request:
```
curl -X POST 'http://jsa.life/api/shorten' --user '${YOUR_USER_NAME}' -H 'Content-Type:application/json' -d '{"original":"https://cmujsa.com","short":"home"}'
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
- yarn (available via npm)
- redis (For mac users: `brew install redis`)

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
