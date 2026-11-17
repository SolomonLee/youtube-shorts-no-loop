const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

test('SEC-01: extension capabilities remain restricted to the reviewed manifest', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions || [], ['storage']);
  assert.deepEqual(manifest.action, { default_title: 'Shorts 播完就停', default_popup: 'popup.html' });
  for (const file of ['popup.html', 'popup.js', 'popup.css']) assert.ok(fs.existsSync(path.join(root, file)), file);
  assert.deepEqual(manifest.host_permissions || [], []);
  assert.equal(manifest.background, undefined);
  assert.equal(manifest.externally_connectable, undefined);
  assert.deepEqual(manifest.web_accessible_resources || [], []);
  assert.equal(manifest.content_scripts.length, 1);
  const script = manifest.content_scripts[0];
  assert.deepEqual(script.matches, ['https://www.youtube.com/*', 'https://youtube.com/*']);
  assert.equal(script.world || 'ISOLATED', 'ISOLATED');
  assert.equal(script.all_frames || false, false);
  assert.deepEqual(script.js, ['content.js']);
  assert.deepEqual(script.css, ['content.css']);
});

test('SEC-02: shipped scripts have no network or execution sinks and use only reviewed Chrome APIs', () => {
  // A narrow regression guard, not a JavaScript parser or proof against obfuscation.
  const sinks = [
    /\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bsendBeacon\s*\(/,
    /\beval\s*\(/, /\bFunction\s*\(/, /\bimport\s*\(/,
    /\.\s*(?:innerHTML|outerHTML)\s*=/, /\binsertAdjacentHTML\s*\(/,
    /document\s*\.\s*(?:write|writeln|cookie)\b/,
    /\bpostMessage\s*\(/, /\b(?:localStorage|sessionStorage|indexedDB)\b/
  ];
  for (const file of ['content.js', 'popup.js']) {
    const code = fs.readFileSync(path.join(root, file), 'utf8');
    for (const sink of sinks) assert.doesNotMatch(code, sink, file);
    const remaining = code.replace(/\bchrome\.storage\.local\.(?:get|set)\b/g, '')
      .replace(/\bchrome\.storage\.onChanged\.addListener\b/g, '')
      .replace(/\bchrome\.runtime\.lastError\b/g, '');
    assert.doesNotMatch(remaining, /\bchrome\s*\./, file);
  }
});

test('SEC-03: CI token is read-only and no privileged PR trigger is introduced', () => {
  for (const file of fs.readdirSync(path.join(root, '.github/workflows')).filter(f => /\.ya?ml$/.test(f))) {
    const workflow = fs.readFileSync(path.join(root, '.github/workflows', file), 'utf8');
    assert.match(workflow, /permissions:\s*\n\s+contents: read/, file);
    assert.doesNotMatch(workflow, /pull_request_target|secrets\.|write-all|contents: write/, file);
  }
});

test('SEC-04: shipped files contain no common credential patterns', () => {
  const files = ['content.js', 'content.css', 'popup.js', 'popup.html', 'popup.css', 'manifest.json', '.github/workflows/test.yml'];
  const patterns = [
    /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
    /\bgithub_pat_[A-Za-z0-9_]{30,}\b/,
    /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
    /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
    /https?:\/\/[^\s/:]+:[^\s/@]+@/
  ];
  for (const file of files) for (const pattern of patterns) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, file), 'utf8'), pattern, file);
  }
});
