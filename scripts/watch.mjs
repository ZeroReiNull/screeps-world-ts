import chokidar from 'chokidar';
import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { ScreepsHttpClient } from 'screeps-api';

if (!process.env.SCREEPS_TOKEN) throw new Error('No SCREEPS_TOKEN found in env');

const api = new ScreepsHttpClient({ token: process.env.SCREEPS_TOKEN });
let timer;

chokidar.watch('src', { ignoreInitial: true }).on('all', (event, path) => {
  clearTimeout(timer);

  timer = setTimeout(async () => {
    console.log(`\n[${event}] ${path} -> Deploying...`);

    try {
      execSync('npm run build', { stdio: 'inherit' });

      const code = await readFile('dist/main.js', 'utf8');

      await api.userCodeSet({
        branch: process.env.SCREEPS_BRANCH || 'default',
        modules: { main: code },
      });

      console.log('✅ Upload complete!');
    } catch (e) {
      console.error('❌ Failed:', e.message);
    }
  }, 300);
});

console.log('👀 Watching src/ for changes... Press Ctrl+C to stop.');
