// Run twice with one temporary NARADA_TEST_USER_DATA directory, stages 1 and 2.
// Uses the real Electron main/preload and a fixture account; no live service receives posts.
/* eslint-disable @typescript-eslint/no-require-imports -- Electron's verification harness uses CommonJS. */
const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const fixturePath = process.env.NARADA_TEST_USER_DATA;
if (!fixturePath || !fixturePath.startsWith('/private/tmp/narada-desktop-')) throw new Error('Use an isolated temporary userData directory');
fs.mkdirSync(fixturePath, { recursive: true });
app.setPath('userData', fixturePath);
const stage = process.env.NARADA_TEST_STAGE;
const uid = 'desktop-performance-fixture';
let finished = false;
const timeout = setTimeout(() => { console.error('DESKTOP_TEST_FAILED timeout'); app.exit(1); }, 45000);

async function waitFor(win, expression) {
  for (let i = 0; i < 150; i++) {
    if (await win.webContents.executeJavaScript(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for desktop UI: ' + expression);
}
function seedAuth() {
  const now = Math.floor(Date.now() / 1000);
  const enc = value => btoa(JSON.stringify(value)).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');
  const token = enc({ alg: 'RS256', typ: 'JWT' }) + '.' + enc({ sub: 'desktop-performance-fixture', user_id: 'desktop-performance-fixture', aud: 'narad-muni-14', iss: 'https://securetoken.google.com/narad-muni-14', iat: now, exp: now + 3600, auth_time: now, firebase: { sign_in_provider: 'google.com', identities: {} } }) + '.fixture';
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('firebaseLocalStorageDb', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' });
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('firebaseLocalStorage', 'readwrite');
      tx.objectStore('firebaseLocalStorage').put({ fbase_key: 'firebase:authUser:AIzaSyBS0kmYQfvMBj68riUwi8AkIMCIDtpQbIk:[DEFAULT]', value: { uid: 'desktop-performance-fixture', email: 'fixture@example.invalid', displayName: 'Fixture User', emailVerified: true, isAnonymous: false, providerData: [], stsTokenManager: { accessToken: token, refreshToken: 'fixture', expirationTime: Date.now() + 3600000 }, apiKey: 'AIzaSyBS0kmYQfvMBj68riUwi8AkIMCIDtpQbIk', appName: '[DEFAULT]' } });
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
    };
  });
}
function typeInput(selector, text) {
  const input = document.querySelector(selector);
  if (!input) throw new Error('Input missing');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
app.on('browser-window-created', (_event, win) => {
  win.webContents.debugger.attach('1.3');
  win.webContents.debugger.sendCommand('Fetch.enable', { patterns: [{ urlPattern: '*localhost:3947/api/*' }, { urlPattern: '*identitytoolkit.googleapis.com*' }] }).catch(console.error);
  win.webContents.debugger.on('message', async (_e, method, params) => {
    if (method !== 'Fetch.requestPaused') return;
    const url = new URL(params.request.url);
    let response = { success: true, updates: [], leaves: [], holidays: [], streak: 0 };
    let status = 200;
    if (url.hostname === 'identitytoolkit.googleapis.com') response = { users: [{ localId: uid, email: 'fixture@example.invalid', displayName: 'Fixture User', emailVerified: true, providerUserInfo: [] }] };
    else if (url.pathname === '/api/settings') response = { configs: [{ id: 'SLACK', platform: 'SLACK', isActive: true, repeatEntries: [] }] };
    else if (url.pathname === '/api/leaves') response = { onLeave: false, leaves: [], holidays: [] };
    else if (url.pathname === '/api/drafts') { response = { draft: null }; if (params.request.method !== 'GET') status = 503; }
    else if (url.pathname === '/api/parse') response = { success: true, data: { slackFormat: 'Generated desktop preview', teamsFormat: 'Teams', timeEntries: [], tasks: [], blockers: [] } };
    try { await win.webContents.debugger.sendCommand('Fetch.fulfillRequest', { requestId: params.requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(response)).toString('base64') }); }
    catch (err) { if (!finished) console.error(err); }
  });
  win.webContents.once('did-finish-load', async () => {
    try {
      await win.webContents.executeJavaScript(`(${seedAuth.toString()})()`);
      await win.loadURL('http://localhost:3947/update?date=2026-10-15');
      await waitFor(win, `!!document.querySelector('textarea[placeholder^="What deeds"]')`);
      if (stage === '1') {
        await win.webContents.executeJavaScript(`(${typeInput.toString()})('textarea[placeholder^="What deeds"]', 'Desktop draft before Quit')`);
        await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Invoke the Sage').click()`);
        await waitFor(win, `!!document.querySelector('textarea[placeholder^="The scroll for Slack"]')`);
        await win.webContents.executeJavaScript(`(${typeInput.toString()})('textarea[placeholder^="The scroll for Slack"]', 'Edited desktop preview before Quit')`);
        // The final edit is followed immediately by a real app.quit, before cloud debounce.
        await win.webContents.executeJavaScript(`(${typeInput.toString()})('textarea[placeholder^="What deeds"]', 'Desktop final keystroke Q')`);
      } else {
        const saved = await win.webContents.executeJavaScript(`({text:document.querySelector('textarea[placeholder^="What deeds"]').value, preview:document.querySelector('textarea[placeholder^="The scroll for Slack"]')?.value})`);
        if (saved.text !== 'Desktop final keystroke Q' || saved.preview !== 'Edited desktop preview before Quit') throw new Error('Quit/restart lost draft or preview: ' + JSON.stringify(saved));
      }
      finished = true; clearTimeout(timeout);
      console.log('DESKTOP_TEST_PASSED stage=' + stage);
      app.quit();
    } catch (err) { console.error('DESKTOP_TEST_FAILED', err); clearTimeout(timeout); app.exit(1); }
  });
});
require(path.join(__dirname, '..', 'dist-electron', 'main.js'));
