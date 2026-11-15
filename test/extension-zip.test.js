import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { buildExtensionZip, ZIP_PATH } from '../scripts/build-extension.js';

// Minimal reader for the zip we write ourselves (deflate, no data descriptors).
function readZip(zip) {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const out = {};
  for (let i = 0; i < count; i++) {
    const size = zip.readUInt32LE(at + 20), nameLength = zip.readUInt16LE(at + 28), extra = zip.readUInt16LE(at + 30), comment = zip.readUInt16LE(at + 32);
    const offset = zip.readUInt32LE(at + 42), name = zip.toString('utf8', at + 46, at + 46 + nameLength);
    const start = offset + 30 + zip.readUInt16LE(offset + 26) + zip.readUInt16LE(offset + 28);
    out[name] = inflateRawSync(zip.subarray(start, start + size));
    at += 46 + nameLength + extra + comment;
  }
  return out;
}

test('the downloadable extension zip matches extension/snoomy-siap (run: node scripts/build-extension.js)', () => {
  const committed = readFileSync(ZIP_PATH);
  assert.ok(committed.equals(buildExtensionZip()), 'public/downloads/snoomy-siap.zip is out of date: run node scripts/build-extension.js');
  const files = readZip(committed);
  for (const name of ['manifest.json', 'background.js', 'content.js', 'siap-table.js', 'popup.html', 'popup.js', 'icons/icon-128.png']) {
    assert.ok(files['snoomy-siap/' + name], 'missing ' + name);
  }
  const manifest = JSON.parse(files['snoomy-siap/manifest.json']);
  assert.equal(manifest.manifest_version, 3);
  assert.ok(manifest.host_permissions.includes('https://snoomy.vercel.app/*'));
});
