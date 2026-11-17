const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = readFileSync(path.join(__dirname, '../content.js'), 'utf8');

function setup(pathname = '/shorts/first', options = {}) {
  const video = new EventTarget();
  Object.assign(video, {
    loop: true, currentSrc: 'first.mp4', currentTime: 0,
    isConnected: true, paused: false, short: true,
    closest() { return this.short ? {} : null; },
    getBoundingClientRect() { return { left: 200, top: 80, width: 360, height: 640 }; },
    pause() { this.paused = true; },
    play() { this.paused = false; this.dispatchEvent(new Event('play')); return Promise.resolve(); }
  });
  let mutation;
  const buttons = new Set();
  const document = new EventTarget();
  Object.assign(document, {
    querySelectorAll: () => [video],
    documentElement: { append: (button) => buttons.add(button) },
    createElement: () => {
      const button = new EventTarget();
      button.style = {};
      button.remove = () => buttons.delete(button);
      return button;
    }
  });
  const location = { pathname };
  let storageListener;
  let initialRead;
  vm.runInNewContext(source, {
    document, location, window: new EventTarget(), queueMicrotask,
    requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
    chrome: {
      runtime: {},
      storage: {
        local: { get(defaults, callback) {
          initialRead = () => callback({ enabled: options.enabled ?? true });
          if (!options.delayRead) initialRead();
        } },
        onChanged: { addListener(callback) { storageListener = callback; } }
      }
    },
    MutationObserver: class {
      constructor(callback) { mutation = callback; }
      observe() {}
    }
  });
  return {
    video, buttons,
    setEnabled(value) { storageListener({ enabled: { newValue: value } }, 'local'); },
    finishRead() { initialRead(); },
    clickPlayer({ control = false, outside = false, button = 0 } = {}) {
      const event = new Event('click', { cancelable: true });
      const player = { contains: (element) => !outside && element === video };
      const target = { closest: (selector) => selector.startsWith('button,') ?
        (control ? {} : null) : player };
      Object.defineProperties(event, { target: { value: target }, button: { value: button } });
      document.dispatchEvent(event);
      return event;
    },
    emit: (type) => video.dispatchEvent(new Event(type)),
    setPath(url) { location.pathname = url; },
    async mutate() { mutation(); await Promise.resolve(); },
    async navigate(url) {
      location.pathname = url;
      document.dispatchEvent(new Event('yt-navigate-finish'));
      await Promise.resolve();
    }
  };
}

function pendingReplay(app) {
  app.emit('ended');
  const normalPlay = app.video.play;
  let rejectPlay;
  app.video.play = () => new Promise((resolve, reject) => { rejectPlay = reject; });
  [...app.buttons][0].dispatchEvent(new Event('click'));
  app.video.play = normalPlay;
  return async () => {
    rejectPlay(new Error('AbortError: playback interrupted'));
    await Promise.resolve();
  };
}

test('saved disabled setting leaves the native player untouched on load', async () => {
  const app = setup('/shorts/first', { enabled: false });
  assert.equal(app.video.loop, true);
  app.emit('ended');
  assert.equal(app.buttons.size, 0);
  await app.video.play();
  assert.equal(app.video.paused, false);
});

test('disabling after completion restores loop and resumes playback immediately', () => {
  const app = setup();
  app.video.currentTime = 10;
  app.emit('ended');
  app.setEnabled(false);
  assert.equal(app.video.loop, true);
  assert.equal(app.video.currentTime, 0);
  assert.equal(app.video.paused, false);
  assert.equal(app.buttons.size, 0);
  app.emit('ended');
  assert.equal(app.buttons.size, 0);
  app.setEnabled(true);
  assert.equal(app.video.loop, false);
  app.emit('ended');
  assert.equal(app.video.paused, true);
  assert.equal(app.buttons.size, 1);
});

test('disabling during manual pause preserves the pause and playback position', () => {
  const app = setup();
  app.video.currentTime = 4;
  app.video.pause();
  app.setEnabled(false);
  assert.equal(app.video.loop, true);
  assert.equal(app.video.paused, true);
  assert.equal(app.video.currentTime, 4);
});

test('disabled mode still allows SPA navigation and enabling on another Short', async () => {
  const app = setup();
  app.setEnabled(false);
  await app.navigate('/shorts/second');
  app.emit('ended');
  assert.equal(app.buttons.size, 0);
  app.setEnabled(true);
  app.emit('ended');
  assert.equal(app.buttons.size, 1);
});

test('new toggle wins over a delayed initial storage read', () => {
  const app = setup('/shorts/first', { delayRead: true });
  app.setEnabled(false);
  app.finishRead();
  assert.equal(app.video.loop, true);
  app.emit('ended');
  assert.equal(app.buttons.size, 0);
});

test('disabling cannot revive a stale replay failure', async () => {
  const app = setup();
  const rejectReplay = pendingReplay(app);
  app.setEnabled(false);
  await rejectReplay();
  assert.equal(app.buttons.size, 0);
  assert.equal(app.video.loop, true);
});

test('disabling after an unannounced navigation does not rewind a reused video', () => {
  const app = setup();
  app.emit('ended');
  app.setPath('/shorts/second');
  app.video.currentTime = 3;
  app.setEnabled(false);
  assert.equal(app.video.currentTime, 3);
});

test('plays through to ended, blocks automatic restart, permits explicit replay', async () => {
  const app = setup();
  assert.equal(app.video.loop, false);
  app.emit('playing');
  assert.equal(app.video.paused, false);
  app.emit('ended');
  assert.equal(app.video.paused, true);
  assert.equal(app.buttons.size, 1);
  await app.video.play();
  assert.equal(app.video.paused, true);
  [...app.buttons][0].dispatchEvent(new Event('click'));
  assert.equal(app.video.paused, false);
  assert.equal(app.buttons.size, 0);
  app.emit('ended');
  assert.equal(app.video.paused, true);
  assert.equal(app.buttons.size, 1);
});

test('clicking the completed player replays from zero and stops again at the next end', () => {
  const app = setup();
  app.video.currentTime = 10;
  app.emit('ended');
  assert.equal(app.clickPlayer().defaultPrevented, true);
  assert.equal(app.video.currentTime, 0);
  assert.equal(app.video.paused, false);
  assert.equal(app.buttons.size, 0);
  app.emit('ended');
  assert.equal(app.video.paused, true);
  assert.equal(app.buttons.size, 1);
});

test('player clicks during playback or a manual pause retain native behavior', () => {
  const app = setup();
  app.video.currentTime = 4;
  assert.equal(app.clickPlayer().defaultPrevented, false);
  app.video.pause();
  assert.equal(app.clickPlayer().defaultPrevented, false);
  assert.equal(app.video.currentTime, 4);
  assert.equal(app.video.paused, true);
});

test('controls, other players, and non-primary clicks do not replay', () => {
  const app = setup();
  app.emit('ended');
  for (const options of [{ control: true }, { outside: true }, { button: 2 }]) {
    assert.equal(app.clickPlayer(options).defaultPrevented, false);
    assert.equal(app.video.paused, true);
    assert.equal(app.buttons.size, 1);
  }
});

test('a player click cannot replay a stale route or source before events arrive', () => {
  for (const change of [app => app.setPath('/shorts/second'),
    app => { app.video.currentSrc = 'second.mp4'; }]) {
    const app = setup();
    app.emit('ended');
    change(app);
    assert.equal(app.clickPlayer().defaultPrevented, false);
    assert.equal(app.video.paused, true);
  }
});

test('failed player replay allows another player click to retry', async () => {
  const app = setup();
  app.emit('ended');
  const play = app.video.play;
  app.video.play = () => Promise.reject(new Error('Playback unavailable'));
  app.clickPlayer();
  await Promise.resolve();
  assert.equal(app.buttons.size, 1);
  app.video.play = play;
  app.clickPlayer();
  assert.equal(app.video.paused, false);
  assert.equal(app.buttons.size, 0);
});

test('switching Shorts clears completed state even when video element is reused', async () => {
  const app = setup();
  app.emit('ended');
  await app.navigate('/shorts/second');
  await app.video.play();
  assert.equal(app.video.paused, false);
  assert.equal(app.buttons.size, 0);
});

test('changing source clears completion state', async () => {
  const app = setup();
  app.emit('ended');
  app.video.currentSrc = 'second.mp4';
  app.emit('loadedmetadata');
  await app.video.play();
  assert.equal(app.video.paused, false);
  assert.equal(app.buttons.size, 0);
});

test('regular watch pages are untouched, including after leaving Shorts', async () => {
  const app = setup('/watch?v=regular');
  assert.equal(app.video.loop, true);
  app.emit('ended');
  assert.equal(app.buttons.size, 0);
  await app.navigate('/shorts/first');
  assert.equal(app.video.loop, false);
  app.emit('ended');
  await app.navigate('/watch?v=regular');
  assert.equal(app.video.loop, true);
  assert.equal(app.buttons.size, 0);
  await app.video.play();
  assert.equal(app.video.paused, false);
});

test('removes loop again if YouTube restores it', async () => {
  const app = setup();
  app.video.loop = true;
  await app.mutate();
  assert.equal(app.video.loop, false);
});

test('detached videos release their listeners and replay button', async () => {
  const app = setup();
  app.emit('ended');
  app.video.isConnected = false;
  app.video.short = false;
  await app.mutate();
  assert.equal(app.buttons.size, 0);
  await app.video.play();
  assert.equal(app.video.paused, false);
});

test('failed manual playback leaves a retry button', async () => {
  const app = setup();
  app.emit('ended');
  app.video.play = () => Promise.reject(new Error('Playback unavailable'));
  [...app.buttons][0].dispatchEvent(new Event('click'));
  await Promise.resolve();
  assert.equal(app.buttons.size, 1);
});

test('rejected replay from a previous Short cannot stop the next Short', async () => {
  const app = setup();
  const rejectReplay = pendingReplay(app);
  await app.navigate('/shorts/second');
  app.video.currentSrc = 'second.mp4';
  app.emit('loadedmetadata');
  await rejectReplay();
  assert.equal(app.buttons.size, 0);
  await app.video.play();
  assert.equal(app.video.paused, false);
});

test('rejected replay cannot restore its button after leaving Shorts', async () => {
  const app = setup();
  const rejectReplay = pendingReplay(app);
  await app.navigate('/watch?v=regular');
  await rejectReplay();
  assert.equal(app.buttons.size, 0);
});

test('returning to the same Short does not revive a previous replay request', async () => {
  const app = setup();
  const rejectReplay = pendingReplay(app);
  await app.navigate('/shorts/second');
  await app.navigate('/shorts/first');
  await rejectReplay();
  assert.equal(app.buttons.size, 0);
  await app.video.play();
  assert.equal(app.video.paused, false);
});

test('rejected replay checks the URL before navigation events arrive', async () => {
  const app = setup();
  const rejectReplay = pendingReplay(app);
  app.setPath('/shorts/second');
  await rejectReplay();
  assert.equal(app.buttons.size, 0);
});

test('rejected replay checks the source before metadata events arrive', async () => {
  const app = setup();
  const rejectReplay = pendingReplay(app);
  app.video.currentSrc = 'replacement.mp4';
  await rejectReplay();
  assert.equal(app.buttons.size, 0);
});

test('emptying the same source invalidates its previous replay request', async () => {
  const app = setup();
  const rejectReplay = pendingReplay(app);
  app.emit('emptied');
  await rejectReplay();
  assert.equal(app.buttons.size, 0);
  await app.video.play();
  assert.equal(app.video.paused, false);
});

test('detaching and reattaching a video invalidates its previous replay request', async () => {
  const app = setup();
  const rejectReplay = pendingReplay(app);
  app.video.isConnected = false;
  app.video.short = false;
  await app.mutate();
  app.video.isConnected = true;
  app.video.short = true;
  await app.mutate();
  await rejectReplay();
  assert.equal(app.buttons.size, 0);
  await app.video.play();
  assert.equal(app.video.paused, false);
});
