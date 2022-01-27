const { execSync } = require('child_process');
const fs = require('fs');

fs.mkdirSync('.vercel', { recursive: true });

const VERCEL_CONFIG = {
  projectId: process.env.VERCEL_PROJECT_ID,
  orgId: process.env.VERCEL_ORG_ID,
};

fs.writeFileSync('.vercel/project.json', JSON.stringify(VERCEL_CONFIG));
execSync(`npx vercel env pull .env --token ${process.env.VERCEL_SOUND_TOKEN}`, {
  stdio: 'inherit',
});

require('./link-env.js');
