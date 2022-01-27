const { symlink } = require('fs');
const { join, resolve } = require('path');

const ROOT = resolve(__dirname, '..');
const ENV_FILE = resolve(ROOT, '.env');

const envLink = dirName => join(ROOT, dirName, '.env');

const createSymLink = dest => {
  symlink(ENV_FILE, dest, err => {
    const ALREADY_EXISTS = err?.errno === -17;
    // Safely ignore if the symlink already exists
    if (err && !ALREADY_EXISTS) throw err;
  });
};

createSymLink(envLink('protocol'));
createSymLink(envLink('common'));
