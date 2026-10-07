import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
function run(command, args, cwd = root, capture = false) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}`);
  return result.stdout?.trim();
}

// Reuse the source repository's destination and identity.
const remote = run('git', ['remote', 'get-url', 'origin'], root, true);
const name = run('git', ['config', 'user.name'], root, true);
const email = run('git', ['config', 'user.email'], root, true);
run('npm', ['test']);
run('npm', ['run', 'build']);

const temp = mkdtempSync(join(tmpdir(), 'ws-by-phn-deploy-'));
try {
  const branch = spawnSync('git', ['ls-remote', '--exit-code', remote, 'refs/heads/gh-pages'], { encoding: 'utf8' });
  if (branch.status === 0) {
    run('git', ['clone', '--depth', '1', '--single-branch', '--branch', 'gh-pages', remote, temp]);
  } else if (branch.status === 2) {
    run('git', ['init', '-b', 'gh-pages'], temp);
    run('git', ['remote', 'add', 'origin', remote], temp);
  } else {
    throw new Error('Could not check the gh-pages branch. Verify GitHub access.');
  }
  // Replace published files in this temporary checkout; preserve branch history.
  for (const entry of readdirSync(temp)) {
    if (entry !== '.git') rmSync(join(temp, entry), { recursive: true, force: true });
  }
  cpSync(join(root, 'dist'), temp, { recursive: true });
  writeFileSync(join(temp, '.nojekyll'), '');
  run('git', ['config', 'user.name', name], temp);
  run('git', ['config', 'user.email', email], temp);
  run('git', ['add', '.'], temp);
  const changed = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: temp });
  if (changed.status === 1) {
    const revision = run('git', ['rev-parse', '--short', 'HEAD'], root, true);
    run('git', ['commit', '-m', `Deploy WS by PHN (${revision})`], temp);
    run('git', ['push', 'origin', 'gh-pages'], temp);
  } else if (changed.status !== 0) {
    throw new Error('Could not check the deployment changes.');
  } else {
    console.log('Published files are already up to date.');
  }
  console.log('GitHub Pages will publish the site at https://lenoirol.github.io/Worksheet/');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
