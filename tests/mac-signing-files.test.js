'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDataFileFilter } = require('../build/sign-macos.cjs');

test('Mac signing retains native code regardless of extension and skips binary data', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-sign-filter-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const native = path.join(root, 'native-without-extension');
  const data = path.join(root, 'locale.pak');
  fs.writeFileSync(native, Buffer.from('cffaedfe00000000', 'hex'));
  fs.writeFileSync(data, Buffer.from([0, 1, 2, 3, 255, 0]));
  const ignore = createDataFileFilter();
  assert.equal(ignore(root), false, 'bundle directories must be signed');
  assert.equal(ignore(native), false, 'Mach-O code must be signed');
  assert.equal(ignore(data), true, 'data is sealed by the parent bundle');
});

test('Mac signing retains universal code and deduplicates framework aliases', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-sign-alias-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const native = path.join(root, 'library');
  const alias = path.join(root, 'alias');
  fs.writeFileSync(native, Buffer.from('cafebabe00000000', 'hex'));
  fs.symlinkSync(native, alias);
  const ignore = createDataFileFilter();
  assert.equal(ignore(native), false);
  assert.equal(ignore(alias), true, 'same native file only needs signing once');
});

test('Mac signing preserves upstream exclusions and fails on missing inputs', () => {
  const ignore = createDataFileFilter(file => file.endsWith('.kext'));
  assert.equal(ignore('/excluded.kext'), true);
  assert.throws(() => ignore('/missing-mineradio-signing-input'), /ENOENT/);
});
