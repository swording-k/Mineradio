'use strict';

// Run with Node on a Mac: node scripts/check-macos-runtime.js
// Requires the installed Electron dependency and an active macOS desktop session.
// The child loads the real main entry. Both runs share only a disposable profile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const appRoot = path.resolve(__dirname, '..');
const resultPrefix = 'MINERADIO_MAC_QA_RESULT:';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function until(check, label, timeout = 12000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) { lastError = error; }
    await delay(100);
  }
  throw new Error(`Timed out: ${label}${lastError ? ` (${lastError.message})` : ''}`);
}

function writeSilentWav(file) {
  const samples = 8000 * 90;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(samples * 2, 40);
  fs.writeFileSync(file, wav);
  fs.writeFileSync(file.replace(/\.wav$/, '.lrc'), '[00:00.00]macOS smoke test\n[00:01.00]本地歌词验证\n');
}

async function runParent() {
  assert.equal(process.platform, 'darwin', 'This smoke check must run on macOS.');
  const { spawn } = require('node:child_process');
  const electron = process.env.MINERADIO_QA_ELECTRON || require('electron');
  assert.equal(typeof electron, 'string', 'Run this script with Node, not Electron.');
  assert(fs.existsSync(electron), 'Electron is missing; install dependencies first.');
  // The real application's legacy migration consumes credentials beside its
  // source. Never let a QA first run migrate or clear an existing source login.
  for (const name of ['.cookie', '.qq-cookie', '.kugou-cookie', '.kugou-vip-evidence.json', '.qishui-cookie', '.qishui-token', '.spotify-token.json', '.spotify-credentials.json', 'spotify-credentials.json', '.qishui-oauth.json', 'qishui-oauth.json']) {
    assert(!fs.existsSync(path.join(appRoot, name)), `Use a clean checkout for QA; legacy app data exists: ${name}`);
  }
  const temporaryParent = process.env.MINERADIO_QA_TMPDIR || os.tmpdir();
  fs.mkdirSync(temporaryParent, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(temporaryParent, 'mineradio-macos-smoke-'));
  const profile = path.join(temporary, 'profile');
  const runtime = `MineradioMacQA-${process.pid}-${Date.now()}`;
  writeSilentWav(path.join(temporary, '本地测试 audio.wav'));
  const run = phase => new Promise((resolve, reject) => {
    const childEnv = {
      ...process.env,
      MINERADIO_MAC_QA_CHILD: '1',
      MINERADIO_MAC_QA_ROOT: temporary,
      MINERADIO_MAC_QA_PHASE: phase,
      MINERADIO_RUNTIME_NAME: runtime,
      MINERADIO_STARTUP_QA_USER_DATA: profile,
      MINERADIO_STARTUP_QA_HIDDEN: '1',
      MINERADIO_STARTUP_QA_EXIT_MS: '0',
      MINERADIO_NO_DESKTOP_SHORTCUT: '1',
    };
    delete childEnv.ELECTRON_RUN_AS_NODE;
    const child = spawn(electron, [__filename], { cwd: appRoot, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let forceKill;
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      forceKill = setTimeout(() => child.kill('SIGKILL'), 5000);
    }, 90000);
    child.stdout.on('data', chunk => {
      stdout = (stdout + chunk).slice(-1024 * 1024);
      if (process.env.MINERADIO_QA_DIAGNOSTICS === '1') process.stdout.write(chunk);
    });
    child.stderr.on('data', chunk => {
      stderr = (stderr + chunk).slice(-128 * 1024);
      if (process.env.MINERADIO_QA_DIAGNOSTICS === '1') process.stderr.write(chunk);
    });
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('close', (code, signal) => {
      clearTimeout(timeout);
      clearTimeout(forceKill);
      const line = stdout.split(/\r?\n/).filter(value => value.startsWith(resultPrefix)).pop();
      let result;
      try { result = line && JSON.parse(line.slice(resultPrefix.length)); } catch (_) {}
      if (code !== 0 || !result || !result.ok) {
        reject(new Error(`${phase} failed (${signal || code}): ${result && result.error || 'No successful QA result'}\n${stdout.slice(-6000)}\n${stderr.slice(-4000)}`));
      } else {
        result.checks.push('graceful application exit');
        console.log(`[OK] ${phase}: ${result.checks.join(', ')}`);
        resolve(result);
      }
    });
  });
  try {
    await run('import-and-lifecycle');
    await run('restart-persistence');
    console.log('macOS real-app smoke check passed; disposable profile removed.');
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

async function runChild() {
  const { app, BrowserWindow, Menu } = require('electron');
  const temporary = process.env.MINERADIO_MAC_QA_ROOT;
  assert(temporary && path.isAbsolute(temporary) && path.basename(temporary).startsWith('mineradio-macos-smoke-'));
  assert.equal(process.env.MINERADIO_STARTUP_QA_USER_DATA, path.join(temporary, 'profile'));
  assert.equal(process.env.MINERADIO_STARTUP_QA_HIDDEN, '1');
  const checks = [];
  const mouseIgnored = new Map();
  const mouseHistory = new Map();
  let finished = false;
  let completedResult;
  let forceExit;
  const finish = (ok, error) => {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
    completedResult = { ok, checks, error: error && String(error.stack || error) };
    if (!ok) console.log(resultPrefix + JSON.stringify(completedResult));
    // Normal app cleanup runs first; only this disposable Electron process can
    // reach the bounded exit fallback if its shutdown hooks become stuck.
    forceExit = setTimeout(() => {
      console.log(resultPrefix + JSON.stringify({ ok: false, checks, error: 'The real application did not exit within 18 seconds; QA forced shutdown.' }));
      app.exit(1);
    }, 18000);
    app.quit();
  };
  const timeout = setTimeout(() => finish(false, new Error('Real app QA exceeded 65 seconds')), 65000);
  app.on('will-quit', () => {
    if (completedResult && completedResult.ok) console.log(resultPrefix + JSON.stringify(completedResult));
  });
  if (process.env.MINERADIO_QA_DIAGNOSTICS === '1') {
    app.on('session-created', session => {
      const original = session.clearStorageData.bind(session);
      session.clearStorageData = async options => {
        console.log('[MacQA] session storage reset started');
        try { return await original(options); }
        finally { console.log('[MacQA] session storage reset finished'); }
      };
    });
  }
  app.on('browser-window-created', (_event, win) => {
    win.webContents.setAudioMuted(true);
    win.setOpacity(1);
    win.on('show', () => { if (!win.isDestroyed()) win.setOpacity(1); });
    const original = win.setIgnoreMouseEvents.bind(win);
    win.setIgnoreMouseEvents = (ignore, options) => {
      mouseIgnored.set(win.id, ignore);
      const history = mouseHistory.get(win.id) || [];
      history.push(ignore);
      mouseHistory.set(win.id, history);
      return original(ignore, options);
    };
  });

  try {
    require(path.join(appRoot, 'desktop', 'main.js'));
    await app.whenReady();
    const stateFile = path.join(temporary, 'profile', 'startup-state.json');
    await until(() => fs.existsSync(stateFile) && JSON.parse(fs.readFileSync(stateFile, 'utf8')).phase === 'ready', 'real main startup', 35000);
    const win = BrowserWindow.getAllWindows().find(candidate => /^http:\/\/127\.0\.0\.1:\d+\//.test(candidate.webContents.getURL()));
    assert(win, 'Real main BrowserWindow was not found.');
    const webContentsId = win.webContents.id;
    const evaluate = expression => win.webContents.executeJavaScript(expression, true);
    await until(() => evaluate('!!(window.desktopWindow && typeof handleFiles === "function" && typeof playQueueAt === "function")'), 'renderer and preload');
    assert.equal(app.getPath('userData'), path.join(temporary, 'profile'));
    for (const key of ['COOKIE_FILE', 'QQ_COOKIE_FILE', 'QISHUI_TOKEN_FILE', 'MINERADIO_BEAT_CACHE_DIR']) {
      assert(process.env[key].startsWith(path.join(temporary, 'profile') + path.sep), `${key} escaped the QA profile`);
    }
    assert.equal(await evaluate('window.desktopWindow.platform'), 'darwin');
    checks.push('real startup and isolated writable paths');
    if (process.env.MINERADIO_QA_SCREENSHOT && process.env.MINERADIO_MAC_QA_PHASE !== 'restart-persistence') {
      const screenshot = path.resolve(process.env.MINERADIO_QA_SCREENSHOT);
      fs.mkdirSync(path.dirname(screenshot), { recursive: true });
      fs.writeFileSync(screenshot, (await win.webContents.capturePage()).toPNG());
    }

    const menu = Menu.getApplicationMenu();
    assert(menu && menu.items.some(item => item.submenu && item.submenu.items.some(child => child.role === 'quit')));
    assert(menu.items.some(item => item.role === 'editmenu'));
    assert(menu.getMenuItemById('desktop-lyrics-locked'));
    checks.push('native application menu');

    if (process.env.MINERADIO_MAC_QA_PHASE === 'restart-persistence') {
      const result = await evaluate('window.desktopWindow.listLocalMusicLibrary()');
      assert.equal(result.count, 1);
      assert.match(result.tracks[0].localUrl, /^mineradio-local:\/\/audio\//);
      assert.equal(result.tracks[0].name, '本地测试 audio');
      const lyric = await evaluate(`window.desktopWindow.readLocalMusicLyric(${JSON.stringify(result.tracks[0].localFileId)})`);
      assert.match(lyric.lyric, /本地歌词验证/);
      const range = await evaluate(`(async () => { const r = await fetch(${JSON.stringify(result.tracks[0].localUrl)}, {headers: {Range: 'bytes=0-43'}}); return {status: r.status, bytes: (await r.arrayBuffer()).byteLength}; })()`);
      assert.deepEqual(range, { status: 206, bytes: 44 });
      checks.push('local track and lyrics survive process restart', 'registered local media protocol and byte ranges');
      finish(true);
      return;
    }

    assert.equal((await evaluate('window.desktopWindow.listLocalMusicLibrary()')).count, 0);
    win.webContents.debugger.attach('1.3');
    const document = await win.webContents.debugger.sendCommand('DOM.getDocument');
    const input = await win.webContents.debugger.sendCommand('DOM.querySelector', { nodeId: document.root.nodeId, selector: '#file-input' });
    assert(input.nodeId, 'Real file input is missing.');
    // CDP creates native File objects, exercising webUtils.getPathForFile and
    // the real preload authorization/import path rather than injecting paths.
    await win.webContents.debugger.sendCommand('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [path.join(temporary, '本地测试 audio.wav')] });
    win.webContents.debugger.detach();
    await until(async () => (await evaluate('window.desktopWindow.listLocalMusicLibrary()')).count === 1, 'native WAV file import');
    await until(() => evaluate('!!(audio && !audio.paused && audio.readyState >= 2 && audio.currentTime > 0.1 && /^mineradio-local:/.test(audio.currentSrc))'), 'real silent WAV playback', 15000);
    checks.push('native local WAV import and actual audio playback');
    app.focus({ steal: true });
    win.show();
    win.focus();
    assert.equal(win.isFullScreenable(), true);
    await evaluate('window.desktopWindow.toggleFullscreen()');
    await until(() => win.isFullScreen(), 'native full-screen entry');
    await delay(1800);
    const display = require('electron').screen.getDisplayMatching(win.getBounds());
    assert(win.getBounds().width >= display.workArea.width, 'Full screen must fill the display width');
    assert(win.getBounds().height >= display.workArea.height, 'Full screen must fill the usable display height');
    await evaluate('window.desktopWindow.exitFullscreenWindowed()');
    await until(() => !win.isFullScreen(), 'native full-screen exit');
    await delay(1800);
    checks.push('native macOS full-screen entry, display coverage and window restoration');
    const playbackState = () => evaluate('audio && ({ paused: audio.paused, ended: audio.ended, time: audio.currentTime, duration: audio.duration, src: audio.currentSrc, contextState: audioCtx && audioCtx.state })');

    const assertSameWindow = () => {
      assert.equal(win.isDestroyed(), false, 'Lifecycle action destroyed the playback window.');
      assert.equal(win.webContents.id, webContentsId, 'Lifecycle action replaced the renderer.');
    };
    const activate = async () => {
      app.show();
      app.emit('activate', {}, true);
      app.focus({ steal: true });
      win.show();
      win.focus();
      await until(() => !app.isHidden() && win.isVisible() && !win.isMinimized(), 'Dock activation restores the existing window');
      await delay(350);
      assertSameWindow();
    };
    app.hide();
    await until(() => !win.isVisible(), 'Cmd-H hide');
    await delay(1300);
    assert.equal(win.isVisible(), false, 'Visibility guard undid app hiding.');
    assertSameWindow();
    await activate();
    if (process.env.MINERADIO_QA_DIAGNOSTICS === '1') {
      console.log('[MacQA] before minimize', { visible: win.isVisible(), minimizable: win.isMinimizable(), fullscreen: win.isFullScreen(), focused: win.isFocused(), hidden: app.isHidden(), dock: app.dock.isVisible() });
      win.on('minimize', () => console.log('[MacQA] minimize event'));
      win.on('restore', () => console.log('[MacQA] restore event'));
    }
    win.minimize();
    await until(() => win.isMinimized(), 'native minimization');
    await delay(1300);
    assert.equal(win.isMinimized(), true, 'Visibility guard undid native minimization.');
    assertSameWindow();
    await activate();
    win.close();
    await until(() => !win.isDestroyed() && !win.isVisible(), 'native close hides the window');
    await delay(1300);
    assertSameWindow();
    assert.equal(win.isVisible(), false, 'Visibility guard undid native close.');
    await activate();
    const afterLifecycle = await playbackState();
    assert(afterLifecycle && !afterLifecycle.paused && /^mineradio-local:/.test(afterLifecycle.src), `Playback after lifecycle: ${JSON.stringify(afterLifecycle)}`);
    checks.push('hide, minimize, close and Dock activation preserve the playback renderer');

    const enabled = menu.getMenuItemById('desktop-lyrics-enabled');
    assert.equal(enabled.checked, false);
    enabled.click(enabled, win, {});
    const overlay = await until(() => BrowserWindow.getAllWindows().find(candidate => candidate.id !== win.id && /Desktop Lyrics|桌面歌词|desktop-lyrics/.test(candidate.getTitle() + candidate.webContents.getURL())), 'desktop lyrics window');
    const locked = menu.getMenuItemById('desktop-lyrics-locked');
    await until(() => locked.enabled, 'desktop lyrics menu enabled');
    await until(() => !overlay.webContents.isLoading(), 'desktop lyrics document ready');
    await delay(400);
    if (!locked.checked) locked.click(locked, win, {});
    await until(() => locked.checked && mouseIgnored.get(overlay.id) === true, 'native menu locks desktop lyrics');
    if (process.env.MINERADIO_QA_DIAGNOSTICS === '1') console.log('[MacQA] lyrics before unlock', { id: overlay.id, checked: locked.checked, ignored: mouseIgnored.get(overlay.id), history: mouseHistory.get(overlay.id), windows: BrowserWindow.getAllWindows().map(w => ({id: w.id, title: w.getTitle()})) });
    const beforeUnlock = (mouseHistory.get(overlay.id) || []).length;
    locked.click(locked, win, {});
    if (process.env.MINERADIO_QA_DIAGNOSTICS === '1') console.log('[MacQA] lyrics after unlock', { checked: locked.checked, ignored: mouseIgnored.get(overlay.id), history: mouseHistory.get(overlay.id) });
    // An unlocked overlay may still pass through the mouse outside its lyric
    // bounds. Verify that unlocking actually enabled capture, not that capture
    // remains on while the physical cursor is elsewhere on the desktop.
    await until(() => !locked.checked && (mouseHistory.get(overlay.id) || []).slice(beforeUnlock).includes(false), 'native menu unlocks desktop lyrics');
    locked.click(locked, win, {});
    await until(() => mouseIgnored.get(overlay.id) === true, 'native menu relocks desktop lyrics');
    enabled.click(enabled, win, {});
    await until(() => overlay.isDestroyed(), 'desktop lyrics close');
    checks.push('desktop lyrics native menu lock and unlock');
    finish(true);
  } catch (error) {
    finish(false, error);
  }
}

if (process.env.MINERADIO_MAC_QA_CHILD === '1' && process.versions.electron) {
  runChild().catch(error => { console.error(error); require('electron').app.exit(1); });
} else {
  runParent().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
}
