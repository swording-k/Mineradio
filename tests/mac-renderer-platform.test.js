'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const preload = read('public/js/preload-mode.js');
const hotkeys = read('public/js/modules/07-fx/06-hotkeys.js');
const update = read('public/js/modules/08-account/00-update-preview.js');
const actions = read('public/js/modules/00-state/00-core-stores.js').match(/var HOTKEY_ACTIONS = \[[\s\S]*?\n\];/)[0];

function classes() {
  const values = new Set();
  return {
    add: value => values.add(value),
    remove: value => values.delete(value),
    contains: value => values.has(value),
    toggle(value, enabled) { if (enabled) values.add(value); else values.delete(value); }
  };
}

function harness(platform, capabilities) {
  const nodes = {};
  const events = {};
  const stored = new Map();
  const context = vm.createContext({
    URL, Promise,
    window: { desktopWindow: { isDesktop: true, platform, capabilities }, addEventListener() {} },
    document: {
      documentElement: { classList: classes() },
      getElementById: id => nodes[id] || null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener(name, handler) { (events[name] ||= []).push(handler); }
    },
    localStorage: { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) },
    HOTKEY_SETTINGS_STORE_KEY: 'hotkeys',
    hotkeyCaptureState: null,
    hotkeyGlobalStatus: {},
    freeCamera: { active: false, keys: {} },
    isTypingTarget: () => false,
    escHtml: value => String(value),
    showToast() {},
    setTimeout: () => 1
  });
  vm.runInContext(preload, context);
  return { context, nodes, events, stored };
}

function loadHotkeys(context) {
  vm.runInContext(actions + '\n' + hotkeys, context);
  context.hotkeySettings = context.getHotkeyDefaults();
  context.renderHotkeySettings = () => {};
}

function loadFunction(context, file, name) {
  const source = read(file);
  const start = source.indexOf('function ' + name + '(');
  const end = source.indexOf('\n}', start) + 2;
  assert.ok(start >= 0 && end > start, name);
  vm.runInContext(source.slice(start, end), context);
}

test('trusted platform capabilities hide Windows controls and preserve legacy Windows behavior', () => {
  for (const platform of ['darwin', 'win32', undefined]) {
    const { context } = harness(platform);
    assert.equal(context.isMacDesktop(), platform === 'darwin');
    assert.equal(context.document.documentElement.classList.contains('desktop-platform-mac'), platform === 'darwin');
    assert.equal(context.desktopFeatureAvailable('fullDesktopMode'), platform !== 'darwin');
    assert.equal(context.desktopFeatureAvailable('wallpaperEngine'), platform !== 'darwin');
    assert.equal(context.desktopFeatureAvailable('desktopLyrics'), true);
    assert.equal(context.desktopLyricsLockHint().includes('中键'), platform !== 'darwin');
    const node = { classList: classes(), getAttribute: () => 'wallpaperEngine' };
    context.document.querySelectorAll = () => [node];
    context.applyDesktopPlatformUi();
    assert.equal(node.classList.contains('desktop-feature-unavailable'), platform === 'darwin');
  }
  const { context } = harness('darwin', { wallpaperEngine: true });
  assert.equal(context.desktopFeatureAvailable('wallpaperEngine'), true);
});

test('Mac defaults, capture, reset and Electron registration use the same Command binding', async () => {
  const { context, stored } = harness('darwin');
  loadHotkeys(context);
  const binding = context.hotkeySettings.global.togglePlay;
  assert.equal(binding, 'Alt+Meta+Space');
  assert.equal(context.normalizeHotkeyEvent({ code: 'Space', altKey: true, metaKey: true }), binding);
  assert.equal(context.formatHotkey(binding), 'Option + Cmd + Space');
  assert.equal(context.hotkeyToAccelerator(binding), 'Alt+Command+Space');
  assert.equal(context.hotkeySettings.global.toggleDesktopInteraction, '');
  stored.set('hotkeys', JSON.stringify({ global: { togglePlay: 'Ctrl+KeyJ' } }));
  assert.equal(context.readHotkeySettings().global.togglePlay, 'Ctrl+KeyJ', 'explicit user bindings survive');
  context.hotkeySettings.global.togglePlay = 'Ctrl+KeyJ';
  let registered;
  context.getDesktopWindowApi = () => ({ configureGlobalHotkeys: async value => { registered = value; return { results: [] }; } });
  context.resetHotkeyBinding('togglePlay', 'global');
  assert.equal(context.hotkeySettings.global.togglePlay, binding);
  // An archive imported from Windows must not register its unsupported action.
  context.hotkeySettings.global.toggleDesktopInteraction = 'Ctrl+Shift+KeyM';
  await context.registerGlobalHotkeys();
  assert.ok(!registered.some(value => value.action === 'toggleDesktopInteraction'));
  assert.equal(registered.find(value => value.action === 'togglePlay').accelerator, 'Alt+Command+Space');
});

test('Windows hotkey defaults and Win-key accelerator remain unchanged', () => {
  const { context } = harness('win32');
  loadHotkeys(context);
  assert.equal(context.hotkeySettings.global.togglePlay, 'Ctrl+Alt+Space');
  assert.equal(context.hotkeySettings.global.toggleDesktopInteraction, 'Ctrl+Shift+KeyM');
  assert.equal(context.formatHotkey('Meta+KeyJ'), 'Win + J');
  assert.equal(context.hotkeyToAccelerator('Meta+KeyJ'), 'Super+J');
});

test('native Command actions are not intercepted by free camera or single-key player shortcuts', () => {
  const { context, events } = harness('darwin');
  vm.runInContext(read('public/js/modules/04-shelf/06-keyboard-camera-events.js'), context);
  context.freeCamera.active = true;
  context.freeCamera.keys.KeyW = true;
  const nativeEvent = { code: 'KeyQ', metaKey: true, preventDefault: () => assert.fail('native key prevented') };
  assert.equal(context.consumeFreeCameraKeyEvent(nativeEvent, true), false);
  assert.equal(Object.keys(context.freeCamera.keys).length, 0);
  events.keydown = [];
  context.handleConfiguredLocalHotkey = () => false;
  context.shouldSuppressDefaultConfiguredHotkey = () => false;
  let fullscreenCalls = 0;
  context.toggleFullscreen = () => fullscreenCalls++;
  vm.runInContext(read('public/js/modules/10-shell/01-viewport-resize-shortcuts.js'), context);
  events.keydown[0]({ code: 'KeyF', metaKey: true });
  assert.equal(fullscreenCalls, 0);
  events.keydown[0]({ code: 'KeyF', metaKey: false });
  assert.equal(fullscreenCalls, 1);
});

test('restored Windows wallpaper settings cannot start native wallpaper on Mac', async () => {
  const { context } = harness('darwin');
  context.wallpaperEngineSelection = { active: true };
  context.bindWallpaperEngineLibraryEvents = () => assert.fail('Windows native library initialized');
  loadFunction(context, 'public/js/modules/07-fx/03-wallpaper-engine-library.js', 'initializeWallpaperEngineLibrary');
  context.initializeWallpaperEngineLibrary();
  assert.equal(context.wallpaperEngineSelection.active, false);
  context.getDesktopWindowApi = () => ({ setWallpaperMode: () => assert.fail('Windows wallpaper IPC called') });
  context.fx = { wallpaperMode: true };
  loadFunction(context, 'public/js/modules/10-shell/04-desktop-overlay-fullscreen.js', 'applyWallpaperModeState');
  const result = await context.applyWallpaperModeState(true);
  assert.equal(result.error, 'WALLPAPER_PLATFORM_UNSUPPORTED');
  assert.equal(context.fx.wallpaperMode, false);
});

test('console excludes unsupported controls even after resolving nested slider blocks', () => {
  const { context } = harness('darwin');
  loadFunction(context, 'public/js/modules/07-fx/09-console-workspace.js', 'fxConsolePlatformUnavailable');
  loadFunction(context, 'public/js/modules/07-fx/09-console-workspace.js', 'fxConsoleAppendItem');
  const node = { closest: () => ({ getAttribute: () => 'wallpaperEngine' }) };
  context.fxConsoleResolveBlock = () => node;
  assert.equal(context.fxConsolePlatformUnavailable(node), true);
  context.fxConsoleAppendItem(null, null, null, {}, null);
  assert.equal(context.fxConsolePlatformUnavailable({ closest: () => null }), false);
});

test('Mac update UI refuses legacy Windows links and only opens a compatible Mac asset', async () => {
  const releaseUrl = 'https://example.invalid/releases/v3';
  const macUrl = 'https://example.invalid/Mineradio-arm64.dmg';
  const windowsUrl = 'https://example.invalid/windows-download';
  for (const release of [
    { externalUrl: windowsUrl },
    { platform: 'darwin', compatible: false, downloadPages: [{ url: windowsUrl }] },
    { platform: 'darwin', arch: 'arm64', compatible: true, downloadPages: [{ label: 'Apple Silicon', url: macUrl }] }
  ]) {
    const { context, nodes } = harness('darwin');
    nodes['update-footnote'] = {};
    context.updatePreviewState = { currentVersion: '2', selectedDownloadPageIndex: 0 };
    let opened;
    context.window.desktopWindow.openUpdatePage = async url => { opened = url; return { ok: true }; };
    vm.runInContext(update, context);
    context.applyLatestUpdateInfo({ updateAvailable: true, latestVersion: '3', release: { htmlUrl: releaseUrl, ...release } });
    await context.startUpdatePreviewDownload();
    assert.equal(opened, release.compatible ? macUrl : releaseUrl);
    assert.ok(!nodes['update-footnote'].textContent.includes('网盘'));
    assert.equal(context.currentUpdateDownloadPages().length, release.compatible ? 1 : 0);
  }
});
