import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

async function exists(p) {
  try { await fs.lstat(p); return true; } catch (e) { if (e?.code === 'ENOENT') return false; throw e; }
}

async function verifyLink(type) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'symlink-manager-v2-'));
  const target = path.join(root, 'target');
  const link = path.join(root, type === 'junction' ? 'junction-link' : 'symlink-link');
  await fs.mkdir(target);
  await fs.writeFile(path.join(target, 'keep.txt'), 'keep');

  await fs.symlink(target, link, type);
  const stat = await fs.lstat(link);
  assert.equal(stat.isSymbolicLink(), true, `${type}: lstat must identify link`);
  assert.equal(path.resolve(await fs.realpath(link)), path.resolve(target), `${type}: target resolution`);

  let collision = false;
  try { await fs.symlink(target, link, type); } catch (e) { collision = e?.code === 'EEXIST'; }
  assert.equal(collision, true, `${type}: duplicate destination must raise EEXIST`);

  await fs.unlink(link);
  assert.equal(await exists(link), false, `${type}: link removed`);
  assert.equal(await exists(path.join(target, 'keep.txt')), true, `${type}: target contents preserved`);

  await fs.rm(root, { recursive: true, force: true });
}

await verifyLink('dir');
if (process.platform === 'win32') {
  await verifyLink('junction');
  console.log('PASS: symbolic-link and Windows junction create/detect/resolve/collision/remove safety tests');
} else {
  console.log('PASS: symbolic-link create/detect/resolve/collision/remove safety tests');
  console.log('SKIP: true Windows junction test requires Windows');
}
