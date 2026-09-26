import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

async function exists(p) {
  try { await fs.lstat(p); return true; } catch (e) { if (e?.code === 'ENOENT') return false; throw e; }
}

async function verifyLink(type) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'easy-symlinker-v2-'));
  const target = path.join(root, 'target');
  const link = path.join(root, type === 'junction' ? 'junction-link' : 'symlink-link');
  const targetFile = type === 'file' ? target : path.join(target, 'keep.txt');
  if (type !== 'file') await fs.mkdir(target);
  await fs.writeFile(targetFile, 'keep');

  await fs.symlink(target, link, type);
  const stat = await fs.lstat(link);
  assert.equal(stat.isSymbolicLink(), true, `${type}: lstat must identify link`);
  // Canonicalise both paths so Windows 8.3 aliases compare with their long paths.
  assert.equal(await fs.realpath(link), await fs.realpath(target), `${type}: target resolution`);
  if (type === 'file') {
    assert.equal((await fs.stat(link)).isFile(), true, 'file: link resolves to a file');
    assert.equal(await fs.readFile(link, 'utf8'), 'keep', 'file: target content accessible through link');
  }

  let collision = false;
  try { await fs.symlink(target, link, type); } catch (e) { collision = e?.code === 'EEXIST'; }
  assert.equal(collision, true, `${type}: duplicate destination must raise EEXIST`);

  await fs.unlink(link);
  assert.equal(await exists(link), false, `${type}: link removed`);
  assert.equal(await exists(targetFile), true, `${type}: target file preserved`);
  assert.equal(await fs.readFile(targetFile, 'utf8'), 'keep', `${type}: target contents preserved`);

  await fs.rm(root, { recursive: true, force: true });
}

await verifyLink('dir');
await verifyLink('file');
if (process.platform === 'win32') {
  await verifyLink('junction');
  console.log('PASS: file/directory symbolic-link and Windows junction create/detect/resolve/collision/remove safety tests');
} else {
  console.log('PASS: file/directory symbolic-link create/detect/resolve/collision/remove safety tests');
  console.log('SKIP: true Windows junction test requires Windows');
}
