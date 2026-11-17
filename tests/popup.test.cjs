const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../popup.js'), 'utf8');

async function setup({ enabled = true, language = 'zh-TW', failRead = false, failWrite = false } = {}) {
  const toggle = { checked: false, disabled: true, addEventListener(type, fn) { this.change = fn; } };
  const status = { textContent: '' };
  const languageSelect = { value: 'zh-TW', disabled: true, addEventListener(type, fn) { this.change = fn; } };
  const elements = { enabled: toggle, status, language: languageSelect, heading: {}, 'enabled-label': {}, 'language-label': {}, hint: {} };
  const document = { documentElement: {}, getElementById: id => elements[id] };
  const writes = [];
  vm.runInNewContext(source, {
    document,
    chrome: { storage: { local: {
      get: () => failRead ? Promise.reject(new Error('Read failed')) : Promise.resolve({ enabled, language }),
      set: value => { writes.push({ ...value }); return failWrite ? Promise.reject(new Error('Write failed')) : Promise.resolve(); }
    } } }
  });
  await Promise.resolve();
  await Promise.resolve();
  return { toggle, status, writes, languageSelect, elements, document };
}

test('popup reflects the saved switch setting and saves changes', async () => {
  const app = await setup({ enabled: false });
  assert.equal(app.toggle.checked, false);
  assert.equal(app.toggle.disabled, false);
  assert.match(app.status.textContent, /已關閉/);
  app.toggle.checked = true;
  const saving = app.toggle.change();
  assert.equal(app.toggle.disabled, true);
  await saving;
  assert.deepEqual(app.writes, [{ enabled: true }]);
  assert.match(app.status.textContent, /已開啟/);
  assert.equal(app.toggle.disabled, false);
});

test('popup restores the saved switch and displays an error if saving fails', async () => {
  const app = await setup({ failWrite: true });
  app.toggle.checked = false;
  await app.toggle.change();
  assert.equal(app.toggle.checked, true);
  assert.equal(app.toggle.disabled, false);
  assert.match(app.status.textContent, /未儲存/);
});

test('popup stays disabled and reports a failed initial read', async () => {
  const app = await setup({ failRead: true });
  assert.equal(app.toggle.disabled, true);
  assert.match(app.status.textContent, /無法讀取/);
});

test('saved English language translates the popup and errors', async () => {
  const app = await setup({ language: 'en', failWrite: true });
  assert.equal(app.document.documentElement.lang, 'en');
  assert.equal(app.elements['enabled-label'].textContent, 'Stop after playback');
  assert.match(app.status.textContent, /^On:/);
  app.toggle.checked = false;
  await app.toggle.change();
  assert.match(app.status.textContent, /not saved/);
  assert.equal(app.toggle.checked, true);
});

test('language switch saves only language and leaves auto-stop disabled', async () => {
  const app = await setup({ enabled: false });
  app.languageSelect.value = 'en';
  await app.languageSelect.change();
  assert.deepEqual(app.writes, [{ language: 'en' }]);
  assert.equal(app.toggle.checked, false);
  assert.equal(app.document.documentElement.lang, 'en');
  assert.match(app.status.textContent, /^Off:/);
  app.languageSelect.value = 'zh-TW';
  await app.languageSelect.change();
  assert.equal(app.document.documentElement.lang, 'zh-Hant');
  assert.equal(app.elements.heading.textContent, 'Shorts 播完就停');
});

test('failed language save restores the previous selection and language', async () => {
  const app = await setup({ failWrite: true });
  app.languageSelect.value = 'en';
  await app.languageSelect.change();
  assert.equal(app.languageSelect.value, 'zh-TW');
  assert.equal(app.document.documentElement.lang, 'zh-Hant');
  assert.equal(app.languageSelect.disabled, false);
  assert.match(app.status.textContent, /未儲存/);
});
