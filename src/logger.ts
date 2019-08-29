import chalk from 'chalk';

function log(msg: string) {
  console.log(chalk.gray(`[LOG] - ${msg}`));
}

function success(msg: string) {
  console.log(`[${chalk.green('SUCCESS')}] - ${msg}`);
}

function info(msg: string) {
  console.log(`[${chalk.blue('INFO')}] - ${msg}`);
}

function warn(msg: string) {
  console.log(`[${chalk.yellow('WARNING')}] - ${msg}`);
}

function error(msg: string, err?: any) {
  console.log(`[${chalk.red('ERROR')}] - ${msg}`);
  if (err) {
    console.log(err);
  }
}

function custom(title: string, msg: string) {
  console.log(`[${chalk.magenta(title.toUpperCase())}] - ${msg}`);
}

export default {
  log,
  success,
  info,
  warn,
  error,
  custom,
};
