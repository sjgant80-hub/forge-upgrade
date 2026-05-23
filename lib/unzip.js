// Zero-dep ZIP reader — pure JS · Node's zlib for deflate
// ◊·κ=1 · enough ZIP to crack Replit + Lovable exports
//
// Implements just what we need from the ZIP spec:
// - End of central directory record (EOCD)
// - Central directory file headers
// - Local file headers
// - STORED (method 0) and DEFLATE (method 8) compression
// Ignores: ZIP64, encryption, archive comments, multi-disk

const zlib = require('zlib');

const SIG_EOCD = 0x06054b50;
const SIG_CD   = 0x02014b50;
const SIG_LFH  = 0x04034b50;

function findEOCD(buf) {
  // EOCD starts with 0x06054b50. Search from the end (comment can be up to 65535 bytes).
  const max = Math.min(buf.length, 65557);
  for (let i = buf.length - 22; i >= buf.length - max; i--) {
    if (i < 0) break;
    if (buf.readUInt32LE(i) === SIG_EOCD) return i;
  }
  return -1;
}

function readEOCD(buf) {
  const off = findEOCD(buf);
  if (off < 0) throw new Error('Not a ZIP file (no EOCD found)');
  return {
    diskNum:    buf.readUInt16LE(off + 4),
    cdDisk:     buf.readUInt16LE(off + 6),
    diskCDCount: buf.readUInt16LE(off + 8),
    cdCount:    buf.readUInt16LE(off + 10),
    cdSize:     buf.readUInt32LE(off + 12),
    cdOffset:   buf.readUInt32LE(off + 16),
    commentLen: buf.readUInt16LE(off + 20)
  };
}

function readCentralDirectory(buf, eocd) {
  const entries = [];
  let off = eocd.cdOffset;
  for (let i = 0; i < eocd.cdCount; i++) {
    if (buf.readUInt32LE(off) !== SIG_CD) throw new Error('Bad central directory signature at ' + off);
    const method      = buf.readUInt16LE(off + 10);
    const compSize    = buf.readUInt32LE(off + 20);
    const uncompSize  = buf.readUInt32LE(off + 24);
    const nameLen     = buf.readUInt16LE(off + 28);
    const extraLen    = buf.readUInt16LE(off + 30);
    const commentLen  = buf.readUInt16LE(off + 32);
    const externalAttr = buf.readUInt32LE(off + 38);
    const localOffset = buf.readUInt32LE(off + 42);
    const name = buf.slice(off + 46, off + 46 + nameLen).toString('utf8');
    entries.push({ name, method, compSize, uncompSize, localOffset, externalAttr, isDir: name.endsWith('/') });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readEntryData(buf, entry) {
  if (entry.isDir) return Buffer.alloc(0);
  const off = entry.localOffset;
  if (buf.readUInt32LE(off) !== SIG_LFH) throw new Error('Bad local file header at ' + off);
  const nameLen  = buf.readUInt16LE(off + 26);
  const extraLen = buf.readUInt16LE(off + 28);
  const dataStart = off + 30 + nameLen + extraLen;
  const data = buf.slice(dataStart, dataStart + entry.compSize);
  if (entry.method === 0) return data;
  if (entry.method === 8) {
    try { return zlib.inflateRawSync(data); }
    catch (err) { throw new Error('Inflate failed for ' + entry.name + ': ' + err.message); }
  }
  throw new Error('Unsupported compression method ' + entry.method + ' for ' + entry.name);
}

// Skip files we shouldn't bother extracting (binary blobs, lock files, node_modules, etc.)
const SKIP_PATTERNS = [
  /(^|\/)node_modules\//,
  /(^|\/)\.git\//,
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)\.next\//,
  /(^|\/)\.cache\//,
  /\.lock$/, /package-lock\.json$/, /yarn\.lock$/, /pnpm-lock\.yaml$/,
  /\.(png|jpg|jpeg|gif|webp|ico|svg|woff2?|ttf|otf|eot|mp4|mp3|wav|pdf|zip|tar|gz)$/i,
  /\.DS_Store$/, /Thumbs\.db$/
];

function shouldSkip(name) {
  return SKIP_PATTERNS.some(re => re.test(name));
}

// Cap on total extracted bytes to prevent zip-bomb abuse
const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_FILES = 5000;

function extractAll(buf, { keepBinary = false } = {}) {
  const eocd = readEOCD(buf);
  if (eocd.cdCount > MAX_FILES) throw new Error('ZIP has too many entries (' + eocd.cdCount + ' > ' + MAX_FILES + ')');
  const entries = readCentralDirectory(buf, eocd);
  const files = {};
  let total = 0;
  let skipped = 0;
  for (const entry of entries) {
    if (entry.isDir) continue;
    if (!keepBinary && shouldSkip(entry.name)) { skipped++; continue; }
    total += entry.uncompSize;
    if (total > MAX_TOTAL_BYTES) throw new Error('ZIP uncompressed exceeds ' + MAX_TOTAL_BYTES + ' bytes (zip bomb guard)');
    try {
      const data = readEntryData(buf, entry);
      // Text files: decode to string. Binary: keep raw if requested, else skip.
      const isText = /\.(html|htm|js|jsx|ts|tsx|css|scss|sass|md|markdown|json|yml|yaml|toml|txt|env|gitignore|nix)$/i.test(entry.name)
        || /(^|\/)(\.replit|Procfile|Dockerfile|README|LICENSE)/.test(entry.name);
      if (isText) {
        files[entry.name] = data.toString('utf8');
      } else if (keepBinary) {
        files[entry.name] = data;
      } else {
        skipped++;
      }
    } catch (err) {
      console.warn('skipped entry ' + entry.name + ': ' + err.message);
      skipped++;
    }
  }
  return { files, count: Object.keys(files).length, skipped, total_bytes: total };
}

module.exports = { extractAll, readEOCD, readCentralDirectory, readEntryData, shouldSkip };
