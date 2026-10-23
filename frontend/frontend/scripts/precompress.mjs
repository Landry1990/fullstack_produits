// Précompression gzip des assets de build (postbuild).
// nginx sert ces .gz via `gzip_static on` — compression niveau max faite une
// fois au build au lieu du gzip à la volée (niveau 1) à chaque requête.
// Les fichiers déjà compressés (woff/woff2/images/wasm) sont ignorés.
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, constants } from 'node:zlib';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const EXTENSIONS = new Set(['.js', '.css', '.html', '.svg', '.json', '.webmanifest', '.txt', '.xml']);
const MIN_SIZE = 1024; // en dessous, le gain ne vaut pas un fichier de plus

let count = 0, saved = 0;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

for (const file of walk(DIST)) {
  if (!EXTENSIONS.has(extname(file))) continue;
  const content = readFileSync(file);
  if (content.length < MIN_SIZE) continue;
  const gz = gzipSync(content, { level: constants.Z_BEST_COMPRESSION });
  if (gz.length >= content.length) continue;
  writeFileSync(file + '.gz', gz);
  count++;
  saved += content.length - gz.length;
}

console.log(`precompress: ${count} fichiers .gz générés, ${(saved / 1024 / 1024).toFixed(2)} Mo gagnés`);
