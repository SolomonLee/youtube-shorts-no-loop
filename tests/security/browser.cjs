// Real browser tests. Route fulfillment supplies controlled HTTPS responses;
// content.js is loaded by the browser as an extension, never page.addScriptTag().
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const pwModule = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = require(pwModule);
const root = path.resolve(__dirname, '../..');
const evidence = path.resolve(process.env.SECURITY_EVIDENCE_DIR || path.join(root, 'dist/security/latest'));
fs.mkdirSync(evidence, { recursive: true });
fs.mkdirSync(path.join(root, 'dist/security'), { recursive: true });
const hash = (data) => crypto.createHash('sha256').update(data).digest('hex');
const fileHashes = (files) => Object.fromEntries(files.map(f => [f, hash(fs.readFileSync(path.join(root, f)))]));
const assessedFiles = ['manifest.json', 'content.js', 'content.css', '.github/workflows/test.yml'];
const sourceHashes = fileHashes(assessedFiles);
const baseline = execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, 'rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const report = {
  schema: 1, assessedCommit: baseline, extensionVersion: JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'))).version,
  startedAtUtc: new Date().toISOString(), sourceHashes,
  harnessHashes: fileHashes(['tests/security/browser.cjs', 'tests/security/fixtures/player.html', 'tests/security/fixtures/clip.webm']),
  node: process.version, playwright: require(path.join(pwModule, 'package.json')).version,
  platform: process.platform, headless: true, chromiumSandboxRequested: true,
  syntheticResponses: true, checks: [], limitations: [
    'Controlled tests use real Chromium and the unmodified extension, but HTTPS page responses are test fixtures, not YouTube.',
    'Synthetic DOM events and CDP fault injection are explicitly identified per check.',
    'Network observation covers requests surfaced by Playwright/CDP, not OS-level packet capture.',
    'This is a scoped assessment, not a certification or proof of absence of vulnerabilities.'
  ]
};
const write = (name, value) => fs.writeFileSync(path.join(evidence, name), JSON.stringify(value, null, 2) + '\n');
let currentPage;
async function check(id, name, fn) {
  const started = performance.now();
  try {
    const details = await fn();
    const status = details?.reproduced ? 'reproduced' : 'pass';
    report.checks.push({ id, name, status, durationMs: Math.round(performance.now() - started), details });
    console.log(`${status.toUpperCase()} ${id}: ${name}`);
  } catch (error) {
    report.checks.push({ id, name, status: 'fail', durationMs: Math.round(performance.now() - started), error: error.message });
    if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({path: path.join(evidence, `${id}-failure.png`)}).catch(() => {});
    console.error(`FAIL ${id}: ${error.message}`);
  }
}

async function launch() {
  const profile = fs.mkdtempSync(path.join(root, 'dist/security/profile-'));
  return chromium.launchPersistentContext(profile, {
    channel: 'chromium', executablePath: process.env.BROWSER_EXECUTABLE || undefined,
    headless: true, chromiumSandbox: true, viewport: { width: 1000, height: 760 },
    ignoreDefaultArgs: ['--disable-extensions', '--unsafely-disable-devtools-self-xss-warnings', '--disable-ipc-flooding-protection'],
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]
  });
}

async function observe(context, page) {
  const cdp = await context.newCDPSession(page);
  const worlds = [];
  const requests = [];
  cdp.on('Runtime.executionContextCreated', ({context}) => worlds.push(context));
  cdp.on('Runtime.executionContextsCleared', () => { worlds.length = 0; });
  cdp.on('Network.requestWillBeSent', e => {
    const frames = [];
    let stack = e.initiator.stack;
    while (stack) { frames.push(...stack.callFrames); stack = stack.parent; }
    const initiators = [...new Set(frames.map(f => {
      try { return new URL(f.url).protocol === 'chrome-extension:' ? f.url : new URL(f.url).origin; }
      catch { return 'non-url'; }
    }))];
    // Do not save signed YouTube media URLs, cookies, headers or bodies.
    let origin; try { origin = new URL(e.request.url).origin; } catch { origin = 'non-url'; }
    requests.push({ origin, method: e.request.method, type: e.type, initiators });
  });
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  await cdp.send('Performance.enable');
  return { cdp, worlds, requests };
}
async function extensionWorld(observation) {
  const world = observation.worlds.find(w => w.origin.startsWith('chrome-extension://'));
  assert.ok(world, 'Chrome did not expose an extension execution context');
  return world;
}
async function isolated(observation, expression) {
  const world = await extensionWorld(observation);
  const value = await observation.cdp.send('Runtime.evaluate', { contextId: world.id, expression, returnByValue: true, awaitPromise: true });
  if (value.exceptionDetails) throw new Error(value.exceptionDetails.text);
  return value.result.value;
}
async function waitButton(page) {
  await page.locator('.shorts-no-loop-replay').waitFor({state:'visible', timeout:7000});
}

async function controlled() {
  const context = await launch();
  report.browser = context.browser().version();
  // Preserve the executable name without recording the local user's home directory.
  report.browserExecutable = path.basename(process.env.BROWSER_EXECUTABLE || chromium.executablePath());
  const attempted = [];
  const html = fs.readFileSync(path.join(__dirname, 'fixtures/player.html'), 'utf8');
  const clip = fs.readFileSync(path.join(__dirname, 'fixtures/clip.webm'));
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    attempted.push({origin:url.origin, pathname:url.pathname, type:route.request().resourceType()});
    if (!['https://www.youtube.com', 'https://youtube.com', 'https://example.invalid'].includes(url.origin)) return route.abort();
    if (url.pathname === '/security-fixture.webm') return route.fulfill({contentType:'video/webm', body:clip});
    if (route.request().resourceType() === 'document') return route.fulfill({contentType:'text/html', body:html});
    return route.abort();
  });
  const page = currentPage = await context.newPage();
  const obs = await observe(context, page);
  async function fresh(url = 'https://www.youtube.com/shorts/security-fixture') {
    await page.goto(url, {waitUntil:'load'});
    await page.locator('#current').evaluate(v => {
      window.fixtureEvents = [];
      for (const type of ['play','playing','ended','pause','emptied']) v.addEventListener(type, e => {
        window.fixtureEvents.push({type:e.type, trusted:e.isTrusted, time:v.currentTime});
      });
    });
    if (new URL(url).hostname.endsWith('youtube.com') && new URL(url).pathname.startsWith('/shorts/')) {
      await page.waitForFunction(() => !document.querySelector('#current').loop);
    }
  }
  try {
    await check('BR-01', 'Native extension loading and isolated execution', async () => {
      await fresh();
      const identity = await isolated(obs, '({id:chrome.runtime.id, version:chrome.runtime.getManifest().version, permissions:chrome.runtime.getManifest().permissions || []})');
      assert.equal(identity.version, report.extensionVersion);
      assert.deepEqual(identity.permissions, []);
      report.extensionId = identity.id;
      return {identity, loopDisabled:await page.locator('#current').evaluate(v=>!v.loop)};
    });
    await check('BR-02', 'Natural media end and one explicit replay', async () => {
      await fresh();
      await page.locator('#current').evaluate(v => v.play());
      await waitButton(page);
      const first = await page.locator('#current').evaluate(v=>({paused:v.paused, ended:v.ended, time:v.currentTime}));
      assert.ok(first.paused && first.ended);
      await page.getByRole('button', {name:'↻ 重新播放', exact:true}).click();
      await waitButton(page);
      const events = await page.evaluate(()=>window.fixtureEvents);
      assert.equal(events.filter(e=>e.type==='ended' && e.trusted).length, 2);
      await page.screenshot({path:path.join(evidence,'BR-02-native-ended.png')});
      return {first, events, screenshot:'BR-02-native-ended.png'};
    });
    await check('BR-03', 'Nonmatching origin and regular watch page are untouched', async () => {
      const measurements = [];
      for (const url of ['https://example.invalid/shorts/security-fixture','https://www.youtube.com/watch?v=security-fixture']) {
        await fresh(url);
        const result = await page.locator('#current').evaluate(v=>({loop:v.loop, buttons:document.querySelectorAll('.shorts-no-loop-replay').length}));
        assert.deepEqual(result,{loop:true,buttons:0}); measurements.push({url,...result});
      }
      await fresh('https://youtube.com/shorts/security-fixture');
      assert.equal(await page.locator('#current').evaluate(v=>v.loop),false);
      return measurements;
    });
    await check('BR-04', 'Host-page prototype overrides do not hijack isolated script methods', async () => {
      await fresh();
      await page.evaluate(()=>{
        window.attackTriggered = false;
        window.states = 'page-owned-marker';
        document.createElement = () => {window.attackTriggered=true;throw new Error('page override');};
        HTMLMediaElement.prototype.pause = () => {window.attackTriggered=true;};
        document.querySelector('#current').dispatchEvent(new Event('ended'));
      });
      await waitButton(page);
      const state = await page.evaluate(()=>({attackTriggered:window.attackTriggered, pageState:window.states, leakedVideoReference:!!document.querySelector('.shorts-no-loop-replay').video}));
      assert.deepEqual(state,{attackTriggered:false,pageState:'page-owned-marker',leakedVideoReference:false});
      return {event:'synthetic ended',...state};
    });
    await check('BR-05', 'Stale replay rejection cannot lock a new route', async () => {
      await fresh();
      await page.locator('#current').evaluate(v=>v.dispatchEvent(new Event('ended')));
      await waitButton(page);
      await isolated(obs, "globalThis.savedPlay = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function() { return new Promise((resolve,reject)=>{globalThis.rejectReplay=reject;}); }; true");
      await page.getByRole('button',{name:'↻ 重新播放',exact:true}).click();
      await page.evaluate(()=>{history.pushState({},'', '/shorts/next-fixture');document.dispatchEvent(new Event('yt-navigate-finish'));});
      await isolated(obs, "HTMLMediaElement.prototype.play = savedPlay; rejectReplay(new DOMException('Test-only interrupted playback','AbortError')); true");
      await page.locator('#current').evaluate(v=>v.play());
      const state = await page.locator('#current').evaluate(v=>({paused:v.paused,buttons:document.querySelectorAll('.shorts-no-loop-replay').length}));
      assert.deepEqual(state,{paused:false,buttons:0});
      await page.locator('#current').evaluate(v=>v.pause());
      return {faultInjection:'CDP in the isolated extension world, deferred rejection of play()',...state};
    });
    await check('BR-06', 'Forged messages and navigation payloads cause no external request', async () => {
      await fresh();
      const before = attempted.length;
      await page.evaluate(()=>{
        window.postMessage({type:'fetch', url:'https://attacker.invalid/probe', data:'TEST_ONLY_SENTINEL'},'*');
        document.dispatchEvent(new CustomEvent('yt-navigate-finish',{detail:{url:'https://attacker.invalid/probe'}}));
        document.querySelector('#current').dispatchEvent(new Event('ended'));
      });
      await waitButton(page);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert.equal(attempted.filter(r=>r.origin==='https://attacker.invalid').length,0);
      assert.equal(obs.requests.filter(r=>r.initiators.some(i=>i.startsWith('chrome-extension://'))).length,0);
      return {syntheticEvents:true,newRequests:attempted.slice(before),attackerRequests:0,extensionInitiatedRequests:0};
    });
    await check('BR-07', 'Measure repeated unrelated DOM changes (PERF-01 evidence)', async () => {
      await fresh();
      await isolated(obs, "globalThis.videoQueries=0; globalThis.originalQuery=document.querySelectorAll.bind(document); document.querySelectorAll=function(selector){if(selector==='video')videoQueries++;return originalQuery(selector);}; true");
      const before = await obs.cdp.send('Performance.getMetrics');
      const result = await page.evaluate(async()=>{
        const start=performance.now();
        for(let n=0;n<60;n++) {await new Promise(requestAnimationFrame);document.querySelector('#sidebar').textContent='Unrelated update '+n;}
        await new Promise(requestAnimationFrame);
        return {mutationBatches:60,elapsedMs:performance.now()-start};
      });
      const queries = await isolated(obs,'videoQueries');
      const after = await obs.cdp.send('Performance.getMetrics');
      assert.ok(queries>=50,`Expected repeated full scans, observed ${queries}`);
      const metric=(m,n)=>m.metrics.find(x=>x.name===n)?.value;
      return {...result,fullVideoQueries:queries,scriptDurationDeltaSeconds:metric(after,'ScriptDuration')-metric(before,'ScriptDuration'),
        interpretation:'Confirms repeated scans; not an extension-only CPU benchmark or proof of user-visible slowdown.'};
    });
    await check('BR-08', 'Reproduce inactive-video button takeover (FUNC-01, conditional)', async () => {
      await fresh();
      await page.evaluate(()=>{
        const old=document.createElement('ytd-reel-video-renderer');old.hidden=true;
        old.innerHTML='<video id="old" muted></video>';
        document.querySelector('#shorts-container').append(old);
      });
      await page.waitForFunction(()=>!document.querySelector('#old').loop);
      await page.evaluate(()=>document.querySelector('#current').dispatchEvent(new Event('ended')));
      await waitButton(page);
      const before = await isolated(obs,"document.querySelector('.shorts-no-loop-replay').video.id");
      await page.evaluate(()=>document.querySelector('#old').dispatchEvent(new Event('ended')));
      const after = await isolated(obs,"document.querySelector('.shorts-no-loop-replay').video.id");
      assert.equal(before,'current'); assert.equal(after,'old');
      await page.screenshot({path:path.join(evidence,'BR-08-inactive-video.png')});
      return {finding:'FUNC-01',reproduced:true,buttonBefore:before,buttonAfter:after,
        trigger:'Synthetic ended dispatched to a hidden video on the controlled fixture.',
        limitation:'Does not establish that live YouTube generates this event sequence; no privilege escalation or exfiltration shown.',
        screenshot:'BR-08-inactive-video.png'};
    });
    write('controlled-network.json',{requests:obs.requests,attemptedRequests:attempted,unknownOrigins:attempted.filter(r=>!['https://www.youtube.com','https://youtube.com','https://example.invalid'].includes(r.origin))});
  } finally { await context.close(); currentPage=undefined; }
}

async function liveYouTube() {
  if (process.env.LIVE_YOUTUBE !== '1') {
    report.checks.push({id:'LIVE-01',name:'Live signed-out YouTube smoke test',status:'not-run',reason:'Set LIVE_YOUTUBE=1; controlled fixtures do not count as a live-site test.'});
    return;
  }
  const context=await launch();
  const page=currentPage=await context.newPage();
  const obs=await observe(context,page);
  try {
    const response=await page.goto('https://www.youtube.com/shorts', {waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>location.pathname.startsWith('/shorts/') && [...document.querySelectorAll('ytd-reel-video-renderer video')].some(v=>v.readyState>=2),null,{timeout:25000});
    const world=await extensionWorld(obs);
    // Live YouTube does not consistently expose an is-active attribute.
    // Select only when exactly one video visibly intersects the viewport.
    const candidates=await page.locator('video').evaluateAll(videos=>videos.map((v,index)=>{
      const r=v.getBoundingClientRect();const style=getComputedStyle(v);
      const visibleWidth=Math.max(0,Math.min(r.right,innerWidth)-Math.max(r.left,0));
      const visibleHeight=Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,0));
      return {index,inShorts:!!v.closest('ytd-reel-video-renderer'),readyState:v.readyState,
        visible:style.display!=='none'&&style.visibility!=='hidden'&&visibleWidth>100&&visibleHeight>100,
        width:Math.round(visibleWidth),height:Math.round(visibleHeight)};
    }));
    const visible=candidates.filter(v=>v.inShorts&&v.visible&&v.readyState>=2);
    if (visible.length!==1) throw new Error(`Expected one visible Shorts video, found ${visible.length}; no target guessed.`);
    const video=page.locator('video').nth(visible[0].index);
    await video.evaluate(v=>{window.liveEnded=[];v.addEventListener('ended',e=>window.liveEnded.push({trusted:e.isTrusted,time:v.currentTime}));});
    const initial=await video.evaluate(v=>({loop:v.loop,paused:v.paused,duration:Number.isFinite(v.duration)?v.duration:null}));
    assert.equal(initial.loop,false);
    if (await page.locator('.ad-showing').count()) throw new Error('Advertising player present; live playback check deferred.');
    assert.ok(initial.duration>1,'Live video duration unavailable');
    await video.evaluate(async v=>{v.currentTime=Math.max(0,v.duration-0.8);await v.play();});
    await waitButton(page);
    const ended=await page.evaluate(()=>window.liveEnded);
    assert.ok(ended.some(e=>e.trusted));
    assert.equal(await video.evaluate(v=>v.paused),true);
    await page.screenshot({path:path.join(evidence,'LIVE-01-signed-out-youtube.png')});
    report.checks.push({id:'LIVE-01',name:'Live signed-out YouTube smoke test',status:'pass',details:{
      statusCode:response?.status(),url:page.url().split('?')[0],initial,ended,worldOrigin:world.origin,videoSelection:visible[0],
      extensionInitiatedRequests:obs.requests.filter(r=>r.initiators.some(i=>i.startsWith('chrome-extension://'))),
      screenshot:'LIVE-01-signed-out-youtube.png', scope:'One public Short, seek near end, no account login, no endpoint attack.'
    }});
  } catch(error) {
    const status=error.code==='ERR_ASSERTION'?'fail':'blocked';
    report.checks.push({id:'LIVE-01',name:'Live signed-out YouTube smoke test',status,reason:error.message.split('\n')[0],
      details:{pageUrl:page.url().split('?')[0],title:await page.title().catch(()=>''),scope:'No bypass of TLS warnings, login, CAPTCHA or anti-bot controls.'}});
    if (!page.isClosed()) await page.screenshot({path:path.join(evidence,'LIVE-01-blocked.png')}).catch(()=>{});
    console.log(`${status.toUpperCase()} LIVE-01: ${error.message.split('\n')[0]}`);
  } finally {
    write('live-network-summary.json',{origins:Object.fromEntries([...new Set(obs.requests.map(r=>r.origin))].map(origin=>[origin,obs.requests.filter(r=>r.origin===origin).length])),
      extensionInitiatedRequests:obs.requests.filter(r=>r.initiators.some(i=>i.startsWith('chrome-extension://')))});
    await context.close();currentPage=undefined;
  }
}

(async()=>{
  try { await controlled(); await liveYouTube(); }
  catch(error){report.checks.push({id:'BOOTSTRAP',status:'fail',error:error.message});console.error(error.message);}
  assert.deepEqual(fileHashes(assessedFiles),sourceHashes,'Assessment changed production files');
  report.finishedAtUtc=new Date().toISOString();
  write('browser-report.json',report);
  const entries=fs.readdirSync(evidence).filter(f=>f!=='SHA256SUMS.json' && fs.statSync(path.join(evidence,f)).isFile());
  write('SHA256SUMS.json',Object.fromEntries(entries.map(f=>[f,hash(fs.readFileSync(path.join(evidence,f)))])));
  console.log(`Evidence: ${evidence}`);
  if(report.checks.some(c=>c.status==='fail')) process.exitCode=1;
})();
