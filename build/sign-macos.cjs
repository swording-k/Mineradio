'use strict';
const fs = require('node:fs');

const MACH_O_MAGIC = new Set([
  'feedface', 'cefaedfe', 'feedfacf', 'cffaedfe',
  'cafebabe', 'bebafeca', 'cafebabf', 'bfbafeca',
]);

// osx-sign's binary-data heuristic also selects images, locale packs and some
// encoding tables. Those are protected by the containing bundle's resource seal.
// Keep every Mach-O file regardless of its extension, plus all bundle roots.
function createDataFileFilter(previousIgnore) {
  const previous = Array.isArray(previousIgnore) ? previousIgnore : (previousIgnore ? [previousIgnore] : []);
  const seenNativeFiles = new Set();
  return file => {
    if (previous.some(rule => typeof rule === 'function' ? rule(file) : !!file.match(rule))) return true;
    if (!fs.statSync(file).isFile()) return false;
    const header = Buffer.alloc(4);
    const descriptor = fs.openSync(file, 'r');
    try { fs.readSync(descriptor, header, 0, 4, 0); }
    finally { fs.closeSync(descriptor); }
    if (!MACH_O_MAGIC.has(header.toString('hex'))) return true;
    const real = fs.realpathSync(file);
    if (seenNativeFiles.has(real)) return true;
    seenNativeFiles.add(real);
    return false;
  };
}

module.exports = async options => {
  const { signAsync } = require('@electron/osx-sign');
  await signAsync({ ...options, identity: options.identity || '-', ignore: createDataFileFilter(options.ignore) });
};
module.exports.createDataFileFilter = createDataFileFilter;
