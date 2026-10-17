'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { desktopCapabilities, mainWindowPlatformOptions, requestSystemCameraPermission, createMacMenuTemplate } = require('../desktop/platform-support');

const source = fs.readFileSync(path.join(__dirname, '../desktop/main.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

function block(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert(from >= 0 && to > from, `missing runtime block ${start}`);
  return source.slice(from, to);
}

function run(code, values) {
  const context = vm.createContext({ console, setTimeout, clearTimeout, ...values });
  vm.runInContext(code, context);
  return context;
}

test('Mac has native title-bar controls and desktop lyrics without Windows-only capabilities', () => {
  assert.equal(mainWindowPlatformOptions('darwin').titleBarStyle, 'hiddenInset');
  assert.equal(mainWindowPlatformOptions('darwin').frame, true);
  assert.equal(mainWindowPlatformOptions('darwin').fullscreenable, true,
    'fullscreen:false must not disable the native macOS full-screen capability');
  assert.deepEqual(mainWindowPlatformOptions('win32'), {});
  assert.deepEqual(desktopCapabilities('darwin'), {
    fullDesktopMode: false, wallpaperEngine: false, desktopLyrics: true,
    desktopLyricsGlobalMouseToggle: false, tray: false, systemMemoryPurge: false,
  });
  assert.equal(desktopCapabilities('win32').wallpaperEngine, true);
  assert.equal(desktopCapabilities('win32').tray, true);
});

test('startup selects D3D11 only on Windows and leaves the native Mac GPU backend available', () => {
  const startupSwitches = block('const CHROMIUM_SAFE_PERFORMANCE_SWITCHES =', 'const gotSingleInstanceLock =');
  for (const platform of ['darwin', 'linux', 'win32']) {
    const switches = [];
    run(startupSwitches, { process: { platform, env: {} },
      app: { commandLine: { appendSwitch: (name, value) => switches.push([name, value]) } } });
    assert.equal(switches.some(([name]) => name === 'autoplay-policy'), true);
    assert.deepEqual(switches.filter(([name]) => name === 'use-angle'), platform === 'win32' ? [['use-angle', 'd3d11']] : []);
    assert.equal(switches.some(([name]) => name === 'ignore-gpu-blocklist'), false);
  }
});

test('native menu uses macOS quit, close, editing and minimize roles and exposes lyric unlock', () => {
  const changes = [];
  const menu = createMacMenuTemplate({ appName: 'Mineradio', showMainWindow() {}, toggleFullscreen() {},
    setLyricsEnabled: value => changes.push(['enabled', value]), setLyricsLocked: value => changes.push(['locked', value]) });
  const items = menu.flatMap(item => [item, ...(item.submenu || [])]);
  assert.equal(items.find(item => item.role === 'quit').accelerator, 'Command+Q');
  assert.equal(items.find(item => item.role === 'close').accelerator, 'Command+W');
  assert.equal(items.find(item => item.role === 'minimize').accelerator, 'Command+M');
  assert(items.some(item => item.role === 'editMenu'));
  assert(items.some(item => item.role === 'hide'));
  items.find(item => item.id === 'desktop-lyrics-enabled').click({ checked: true });
  items.find(item => item.id === 'desktop-lyrics-locked').click({ checked: false });
  assert.deepEqual(changes, [['enabled', true], ['locked', false]]);
});

test('Mac fullscreen leaves the window frame to AppKit while Windows retains display resizing', () => {
  const calls = [];
  let fullscreen = false;
  const display = { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } };
  const win = { isDestroyed: () => false, isFullScreen: () => fullscreen,
    setBounds: bounds => calls.push(['bounds', bounds.width, bounds.height]),
    setFullScreen: value => { calls.push(['fullscreen', value]); fullscreen = value; } };
  const context = run(block('function exitFullscreenToWindow(win)', 'function overlayUrl('), {
    process: { platform: 'darwin' }, windowFullscreenActive: false, windowFullscreenDisplayId: null,
    sendWindowState() {}, getWindowDisplay: () => display, updateMainWindowMinimumSize() {},
    setMainWindowFullscreenResizeGuard() {}, applyWindowedBounds: () => calls.push(['reset']),
  });
  context.toggleFullscreen(win);
  context.toggleFullscreen(win);
  context.exitFullscreenToWindow(win);
  assert.deepEqual(calls, [['fullscreen', true], ['fullscreen', false], ['fullscreen', false]]);
  calls.length = 0;
  context.process.platform = 'win32';
  context.toggleFullscreen(win);
  context.toggleFullscreen(win);
  context.exitFullscreenToWindow(win);
  assert.deepEqual(calls, [['bounds', 1920, 1080], ['fullscreen', true], ['fullscreen', false], ['reset']]);
});

test('native fullscreen exit preserves the restored Mac frame and retains Windows default layout', () => {
  const win = new EventEmitter();
  const calls = [];
  const context = run(block("  win.on('leave-full-screen', () => {", "  win.on('enter-html-full-screen'"), {
    process: { platform: 'darwin' }, win, windowFullscreenActive: true, windowFullscreenDisplayId: 2,
    setMainWindowFullscreenResizeGuard() {}, clearMainWindowFullscreenVisibilityGuard() {},
    ensureMainWindowInsideDisplay: () => calls.push('clamp'), sendWindowState: () => calls.push('state'),
    setTimeout: callback => callback(), getFullscreenTargetDisplay: () => ({ id: 2 }),
    applyWindowedBounds: () => calls.push('reset'), scheduleWallpaperEngineHostBoundsRestart() {},
  });
  win.emit('leave-full-screen');
  assert.deepEqual(calls, ['clamp', 'state']);
  assert.equal(context.windowFullscreenDisplayId, null);
  assert.equal(context.windowFullscreenActive, false);
  calls.length = 0;
  context.process.platform = 'win32';
  win.emit('leave-full-screen');
  assert.deepEqual(calls, ['reset']);
});

test('Mac close hides only after autosave, leaves renderer alive, and Quit reaches normal close', async () => {
  const closeCode = block("  win.on('close', (event) => {", "  win.on('closed'");
  let completeSave;
  const win = new EventEmitter();
  const calls = [];
  Object.assign(win, { isDestroyed: () => false, hide: () => calls.push('hide'), close: () => calls.push('close') });
  const context = run(closeCode, {
    process: { platform: 'darwin' }, win, appQuitting: false, closeBehavior: 'exit', mainWindowCloseFlushArmed: false,
    app: { quit: () => calls.push('quit') },
    markMainWindowExpectedVisible: (_win, value) => calls.push(['visible', value]),
    flushMainWindowFxAutosave: () => new Promise(resolve => { completeSave = resolve; }),
    sendWindowState() {}, fullDesktopModeRuntime: { getStatus: () => ({ enabled: false }) },
  });
  let prevented = false;
  win.emit('close', { preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(calls.includes('hide'), false);
  completeSave();
  await tick();
  assert.equal(calls.includes('hide'), true);
  assert.equal(calls.includes('close'), false);
  assert.equal(win.__mineradioIntentionalHide, true);
  context.appQuitting = true;
  win.emit('close', { preventDefault() {} });
  completeSave();
  await tick();
  assert.equal(calls.includes('quit'), true);
});

test('application Quit survives the autosave close cancellation and exits after all windows close', async () => {
  const app = new EventEmitter();
  const win = new EventEmitter();
  let closed = false;
  let exited = false;
  let quitCalls = 0;
  let completeSave;
  const cancelable = () => ({ prevented: false, preventDefault() { this.prevented = true; } });
  win.isDestroyed = () => closed;
  win.close = () => {
    const event = cancelable();
    win.emit('close', event);
    if (!event.prevented) { closed = true; app.emit('window-all-closed'); }
    return !event.prevented;
  };
  app.quit = () => {
    quitCalls++;
    const event = cancelable();
    app.emit('before-quit', event);
    if (event.prevented) return;
    if (!closed && !win.close()) return;
    app.emit('will-quit');
    exited = true;
  };
  const quitStart = source.indexOf("  app.on('before-quit', (event) => {");
  const context = run([
    block("  win.on('close', (event) => {", "  win.on('closed'"),
    block("  app.on('window-all-closed', () => {", "  app.on('before-quit'"),
    source.slice(quitStart, source.lastIndexOf('\n}')),
  ].join('\n'), {
    process: { platform: 'darwin' }, app, win, mainWindow: win, appQuitting: false,
    appQuitCleanupComplete: false, appQuitCleanupPromise: null, mainWindowCloseFlushArmed: false, closeBehavior: 'tray',
    clearWallpaperEngineCaptureGrant() {}, wallpaperEngineLibrary: { dispose() {} },
    stopMemoryAutoTimer() {}, unregisterFullDesktopEscapeShortcut() {}, unregisterMineradioGlobalHotkeys() {},
    closeDesktopLyricsWindow() {}, localServer: { close() {} }, tray: null,
    fullDesktopModeRuntime: { dispose: async () => ({ ok: true }), getStatus: () => ({ enabled: false }) },
    wallpaperEngineRuntime: { dispose: async () => ({ ok: true }) },
    flushMainWindowFxAutosave: () => new Promise(resolve => { completeSave = resolve; }),
  });
  app.quit();
  await context.appQuitCleanupPromise;
  assert.equal(quitCalls, 2);
  assert.equal(exited, false);
  assert.equal(closed, false);
  assert.equal(typeof completeSave, 'function');
  completeSave();
  await tick();
  assert.equal(quitCalls, 3);
  assert.equal(closed, true);
  assert.equal(exited, true, 'closing the last macOS window must not leave the application resident after Quit');
});

test('Dock reactivation during close autosave cancels a pending hide', async () => {
  let completeSave;
  const win = new EventEmitter();
  let hidden = false;
  Object.assign(win, { isDestroyed: () => false, hide: () => { hidden = true; } });
  run(block("  win.on('close', (event) => {", "  win.on('closed'"), {
    process: { platform: 'darwin' }, win, appQuitting: false,
    markMainWindowExpectedVisible() {}, sendWindowState() {},
    flushMainWindowFxAutosave: () => new Promise(resolve => { completeSave = resolve; }),
  });
  win.emit('close', { preventDefault() {} });
  win.__mineradioIntentionalHide = false;
  completeSave();
  await tick();
  assert.equal(hidden, false);
});

test('Dock activation reuses the player, recreates a lost window, and does nothing while quitting', async () => {
  const app = new EventEmitter();
  let exists = true;
  let focused = 0;
  let created = 0;
  const context = run(block("  app.on('activate', () => {", "  app.on('window-all-closed'"), {
    app, appQuitting: false, startupCompleted: true,
    focusMainWindow: () => { focused++; return exists; },
    createWindow: async () => { created++; exists = true; },
    reportWindowCreationFailure: assert.fail,
  });
  app.emit('activate');
  assert.equal(created, 0);
  assert.equal(focused, 1);
  exists = false;
  app.emit('activate');
  await tick();
  assert.equal(created, 1);
  assert.equal(focused, 3);
  context.appQuitting = true;
  app.emit('activate');
  assert.equal(focused, 3);
});

test('Cmd+Q performs bounded cleanup once and allows the second quit to finish', async () => {
  const app = new EventEmitter();
  let quitCalls = 0;
  let prevented = 0;
  let serverClosed = 0;
  let runtimeDisposals = 0;
  app.quit = () => { quitCalls++; app.emit('before-quit', { preventDefault: () => { prevented++; } }); };
  const quitStart = source.indexOf("  app.on('before-quit', (event) => {");
  const quitCode = source.slice(quitStart, source.lastIndexOf('\n}'));
  const context = run(quitCode, {
    app, appQuitting: false, appQuitCleanupComplete: false, appQuitCleanupPromise: null,
    clearWallpaperEngineCaptureGrant() {}, wallpaperEngineLibrary: { dispose() {} },
    stopMemoryAutoTimer() {}, unregisterFullDesktopEscapeShortcut() {}, unregisterMineradioGlobalHotkeys() {},
    closeDesktopLyricsWindow() {}, localServer: { close: () => { serverClosed++; } }, tray: null, mainWindow: null,
    fullDesktopModeRuntime: { dispose: async () => { runtimeDisposals++; return { ok: true }; } },
    wallpaperEngineRuntime: { dispose: async () => ({ ok: true }) },
  });
  app.quit();
  await context.appQuitCleanupPromise;
  assert.equal(context.appQuitting, true);
  assert.equal(context.appQuitCleanupComplete, true);
  assert.equal(prevented, 1);
  assert.equal(quitCalls, 2);
  assert.equal(serverClosed, 1);
  assert.equal(runtimeDisposals, 1);
});

test('macOS hide and minimize stay under native window management while Windows recovers unexplained loss', () => {
  const guardCode = block('function shouldRestoreUnexpectedMainWindowVisibility(win)', 'function restoreHiddenMainWindow(');
  const win = { isDestroyed: () => false, isMinimized: () => false, isVisible: () => false, isFullScreen: () => true };
  const context = run(guardCode, { process: { platform: 'darwin' }, appQuitting: false, startupCompleted: true,
    fullDesktopModeHostVisibilityTransitionDepth: 0, fullDesktopModeRuntime: { getStatus: () => ({ enabled: false }) } });
  assert.equal(context.shouldRestoreUnexpectedMainWindowVisibility(win), false);
  assert.equal(context.shouldRestoreUnexpectedFullscreenVisibility(win), false);
  win.isMinimized = () => true;
  assert.equal(context.shouldRestoreUnexpectedMainWindowMinimize(win), false);
  context.process.platform = 'win32';
  assert.equal(context.shouldRestoreUnexpectedMainWindowMinimize(win), true);
  win.isMinimized = () => false;
  assert.equal(context.shouldRestoreUnexpectedMainWindowVisibility(win), true);
  win.__mineradioIntentionalHide = true;
  assert.equal(context.shouldRestoreUnexpectedMainWindowVisibility(win), false);
});

test('macOS never starts PowerShell mouse polling, Explorer hooks or full desktop shortcuts', async () => {
  const context = run([
    block('function startDesktopLyricsMousePoller()', 'function stopDesktopLyricsMousePoller()'),
    block('function hookExplorerRestartForFullDesktop(win)', 'function windowMessageUnsignedValue('),
    block('function hookMainWindowMinimizeIntent(win)', 'function positionWallpaperWindow('),
    block('async function enableFullDesktopMode(win, options = {})', 'async function setFullDesktopModeInteractive('),
  ].join('\n'), {
    process: { platform: 'darwin' }, desktopLyricsMousePoller: null,
    spawn: () => assert.fail('must not launch PowerShell'), execFile: () => assert.fail('must not launch PowerShell'),
    fullDesktopModeRuntime: { getStatus: () => ({ supported: false }) },
    registerFullDesktopEscapeShortcut: () => assert.fail('must not reserve Escape'),
  });
  context.startDesktopLyricsMousePoller();
  context.hookExplorerRestartForFullDesktop({});
  context.hookMainWindowMinimizeIntent({});
  const result = await context.enableFullDesktopMode({});
  assert.equal(result.error, 'FULL_DESKTOP_PLATFORM_UNSUPPORTED');
});

test('camera requests use macOS TCC only for undetermined permission and never request microphone access', async () => {
  const asked = [];
  const preferences = { getMediaAccessStatus: type => { assert.equal(type, 'camera'); return 'not-determined'; },
    askForMediaAccess: async type => { asked.push(type); return true; } };
  assert.equal((await requestSystemCameraPermission(preferences, 'darwin')).ok, true);
  assert.deepEqual(asked, ['camera']);
  preferences.getMediaAccessStatus = () => 'granted';
  assert.equal((await requestSystemCameraPermission(preferences, 'darwin')).ok, true);
  preferences.getMediaAccessStatus = () => 'denied';
  assert.equal((await requestSystemCameraPermission(preferences, 'darwin')).error, 'GESTURE_CAMERA_SYSTEM_PERMISSION_DENIED');
  assert.deepEqual(asked, ['camera']);
  assert.equal((await requestSystemCameraPermission(null, 'win32')).ok, true);
});

test('camera IPC rejects untrusted callers before native prompt and revalidates after it', async () => {
  let handler;
  let trusted = false;
  let asked = 0;
  let grants = 0;
  const context = run(block("ipcMain.handle('mineradio-gesture-camera-request-permission'", "ipcMain.handle('mineradio-wallpaper-update'"), {
    ipcMain: { handle: (_channel, callback) => { handler = callback; } }, systemPreferences: {},
    isTrustedMainWindowIpc: () => trusted,
    requestSystemCameraPermission: async () => { asked++; trusted = false; return { ok: true }; },
    createGestureCameraPermissionGrant: () => { grants++; return trusted ? { expiresAt: 123 } : null; },
  });
  assert.equal((await handler({})).error, 'GESTURE_CAMERA_UNTRUSTED_SENDER');
  assert.equal(asked, 0);
  trusted = true;
  assert.equal((await handler({})).error, 'GESTURE_CAMERA_UNTRUSTED_SENDER');
  assert.equal(asked, 1);
  assert.equal(grants, 1);
  context.requestSystemCameraPermission = async () => ({ ok: true });
  trusted = true;
  assert.equal((await handler({})).expiresAt, 123);
});
