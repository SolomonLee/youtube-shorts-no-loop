const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../popup.js'), 'utf8');

async function setup({ enabled = true, failRead = false, failWrite = false } = {}) {
  const toggle = { checked: false, disabled: true, addEventListener(type, fn) { this.change = fn; } };
  const status = { textContent: '' };
  const writes = [];
  vm.runInNewContext(source, {
    document: { getElementById: id => id === 'enabled' ? toggle : status },
    chrome: { storage: { local: {
      get: () => failRead ? Promise.reject(new Error('Read failed')) : Promise.resolve({ enabled }),
      set: value => { writes.push(value.enabled); return failWrite ? Promise.reject(new Error('Write failed')) : Promise.resolve(); }
    } } }
  });
  await Promise.resolve();
  await Promise.resolve();
  return { toggle, status, writes };
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
  assert.deepEqual(app.writes, [true]);
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
