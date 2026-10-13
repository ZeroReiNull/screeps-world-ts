import { ScreepsHttpClient } from 'screeps-api';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

if (!process.env.SCREEPS_TOKEN) throw new Error('No SCREEPS_TOKEN found in env');

execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
  stdio: 'inherit',
});

const api = new ScreepsHttpClient({ token: process.env.SCREEPS_TOKEN });
const code = await readFile('dist/main.js', 'utf8');

await api.userCodeSet({
  branch: process.env.SCREEPS_BRANCH || 'default',
  modules: { main: code },
});

console.log('✅ Upload complete!');
