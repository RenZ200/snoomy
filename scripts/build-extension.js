// Builds public/downloads/snoomy-siap.zip from extension/snoomy-siap so Snoomy can offer
// the browser extension as a download. The zip is deterministic (sorted entries, fixed
// timestamps, LF line endings), so test/extension-zip.test.js can check it is up to date.
// Run after changing the extension:  node scripts/build-extension.js
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync, crc32 } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const EXTENSION_DIR = join(root, 'extension', 'snoomy-siap');
export const ZIP_PATH = join(root, 'public', 'downloads', 'snoomy-siap.zip');
const TEXT = /\.(js|json|html|css|md|txt|svg)$/i;
const DOS_TIME = 0;                                   // 00:00:00
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1; // 2026-01-01

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

export function buildExtensionZip(dir = EXTENSION_DIR) {
  const entries = files(dir)
    // Files sit at the zip root: Windows "Extract All" then makes one snoomy-siap folder that
    // holds manifest.json directly (a nested folder made "Load unpacked" fail).
    .map(path => ({ name: relative(dir, path).split('\\').join('/'), path }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const local = [], central = [];
  let offset = 0;
  for (const { name, path } of entries) {
    let data = readFileSync(path);
    if (TEXT.test(name)) data = Buffer.from(data.toString('utf8').replace(/\r\n/g, '\n'));
    const packed = deflateRawSync(data, { level: 9 });
    const nameBytes = Buffer.from(name, 'utf8');
    const crc = crc32(data) >>> 0;
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(8, 8); header.writeUInt16LE(DOS_TIME, 10); header.writeUInt16LE(DOS_DATE, 12);
    header.writeUInt32LE(crc, 14); header.writeUInt32LE(packed.length, 18); header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBytes.length, 26); header.writeUInt16LE(0, 28);
    local.push(header, nameBytes, packed);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10); entry.writeUInt16LE(DOS_TIME, 12); entry.writeUInt16LE(DOS_DATE, 14);
    entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(packed.length, 20); entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28); entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);
    offset += header.length + nameBytes.length + packed.length;
  }
  const centralSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(dirname(ZIP_PATH), { recursive: true });
  const zip = buildExtensionZip();
  writeFileSync(ZIP_PATH, zip);
  console.log(`Wrote ${relative(root, ZIP_PATH)} (${zip.length} bytes)`);
}
