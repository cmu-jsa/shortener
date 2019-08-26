import chalk from 'chalk';

function log(msg: string) {
  console.log(chalk.gray(`[log] - ${msg}`));
}

function success(msg: string) {
  console.log(`[${chalk.green('success')}] - ${msg}`);
}

function info(msg: string) {
  console.log(`[${chalk.blue('info')}] - ${msg}`);
}

function warn(msg: string) {
  console.log(`[${chalk.yellow('warning')}] - ${msg}`);
}

function error(msg: string, err?: any) {
  console.log(`[${chalk.red('error')}] - ${msg}`);
  if (err) {
    console.log(err);
  }
}

function custom(title: string, msg: string) {
  console.log(`[${chalk.magenta(title)}] - ${msg}`);
}

export default {
  log,
  success,
  info,
  warn,
  error,
  custom,
};
