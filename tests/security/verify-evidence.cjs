const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const directory=path.resolve(process.argv[2]||'security/evidence/2026-10-21-verified');
const expected=JSON.parse(fs.readFileSync(path.join(directory,'SHA256SUMS.json'),'utf8'));
for(const [file,digest] of Object.entries(expected)) {
  assert.equal(path.basename(file),file,'Evidence paths must be direct children');
  const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(directory,file))).digest('hex');
  assert.equal(actual,digest,`Evidence modified: ${file}`);
}
console.log(`Verified ${Object.keys(expected).length} evidence files. Hashes establish consistency, not independent authorship or certification.`);
