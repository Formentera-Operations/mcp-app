import { execSync } from 'node:child_process';
import { readdirSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const viewsDir = 'views';

if (!existsSync(viewsDir)) {
  console.log('No views/ directory — skipping view build.');
  process.exit(0);
}

const views = readdirSync(viewsDir).filter((f) => f.endsWith('.html'));

if (views.length === 0) {
  console.log('No HTML files in views/ — skipping view build.');
  process.exit(0);
}

// Clean dist/views/ of old HTML files before rebuild
const viewsOutDir = join('dist', 'views');
if (existsSync(viewsOutDir)) {
  for (const file of readdirSync(viewsOutDir)) {
    if (file.endsWith('.html')) {
      rmSync(join(viewsOutDir, file));
    }
  }
}
if (!existsSync('dist')) {
  mkdirSync('dist');
}

for (const view of views) {
  const inputPath = join(viewsDir, view);
  console.log(`Building ${inputPath}...`);
  execSync(`npx cross-env INPUT=${inputPath} vite build`, { stdio: 'inherit' });
}

console.log(`Built ${views.length} view(s) to dist/`);
