// 只转换源码文本作只读比较，不 import/执行任何产品模块；不是性能取样。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const [before, after, output] = process.argv.slice(2);
if (!before || !after || !output) throw new Error('before after output required');
const tools = ['record-operations', 'index-runtime', 'decision-records', 'investigation-report', 'shared'];
const transpiler = new Bun.Transpiler({ loader: 'ts', target: 'node', minifyWhitespace: true, minifySyntax: false, minifyIdentifiers: false });
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');
function files(root) {
  const result = new Map();
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && entry.name.endsWith('.ts')) result.set(path.relative(root, file), file);
    }
  }
  for (const tool of tools) visit(path.join(root, 'tools', tool, 'src'));
  return result;
}
const old = files(before), current = files(after);
const rows = [];
for (const relative of [...new Set([...old.keys(), ...current.keys()])].sort()) {
  const a = old.has(relative) ? fs.readFileSync(old.get(relative), 'utf8') : null;
  const b = current.has(relative) ? fs.readFileSync(current.get(relative), 'utf8') : null;
  const aj = a === null ? null : transpiler.transformSync(a);
  const bj = b === null ? null : transpiler.transformSync(b);
  rows.push({ path: relative, beforeSha256: a === null ? null : hash(a), currentSha256: b === null ? null : hash(b),
    sourceEqual: a === b, beforeNormalizedJsSha256: aj === null ? null : hash(aj),
    currentNormalizedJsSha256: bj === null ? null : hash(bj), normalizedJsEqual: aj === bj });
}
const result = { status: 'read-only pre-final-freeze comparison, not final-source proof or execution-equivalence by itself',
  before, after, transpiler: 'Bun ' + Bun.version + ' Transpiler ts/node whitespace-only minification; products not imported',
  normalizationLimit: 'Equal normalized JS excludes TS/comment/format changes under this transformer. Different JS still requires operation-path review; no automatic semantic-equivalence assertion.',
  comparedFiles: rows.length, rows };
fs.writeFileSync(output, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ comparedFiles: rows.length, sourceChanged: rows.filter(x => !x.sourceEqual).length,
  changedButNormalizedJsEqual: rows.filter(x => !x.sourceEqual && x.normalizedJsEqual).map(x => x.path) }));
