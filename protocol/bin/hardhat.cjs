#!/usr/bin/env node

const { fork } = require('child_process');
const { join } = require('path');

fork(
  require.resolve('hardhat/internal/cli/cli.js'),
  ['--config', join(__dirname, '../dist/hardhat.config.js'), ...process.argv.slice(2)],
  {
    stdio: 'inherit',
  }
);
