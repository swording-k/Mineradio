'use strict';

function desktopCapabilities(platform = process.platform) {
  const windows = platform === 'win32';
  return {
    fullDesktopMode: windows,
    wallpaperEngine: windows,
    desktopLyrics: true,
    desktopLyricsGlobalMouseToggle: windows,
    tray: windows || platform === 'linux',
    systemMemoryPurge: windows,
  };
}

function mainWindowPlatformOptions(platform = process.platform) {
  if (platform !== 'darwin') return {};
  return {
    frame: true,
    // Electron otherwise derives this from the shared fullscreen:false option.
    fullscreenable: true,
    titleBarStyle: 'hiddenInset',
    transparent: false,
    backgroundColor: '#101018',
  };
}

// Request TCC access only after a trusted, user-initiated camera request. The
// renderer's short-lived permission grant starts after the native prompt ends.
async function requestSystemCameraPermission(systemPreferences, platform = process.platform) {
  if (platform !== 'darwin') return { ok: true };
  try {
    const status = systemPreferences.getMediaAccessStatus('camera');
    if (status === 'granted') return { ok: true };
    if (status === 'not-determined' && await systemPreferences.askForMediaAccess('camera')) {
      return { ok: true };
    }
    return {
      ok: false,
      error: 'GESTURE_CAMERA_SYSTEM_PERMISSION_DENIED',
      message: '请在“系统设置 → 隐私与安全性 → 摄像头”中允许 Mineradio 使用摄像头，然后重新打开应用。',
    };
  } catch (_) {
    return { ok: false, error: 'GESTURE_CAMERA_SYSTEM_PERMISSION_FAILED', message: '无法请求系统摄像头权限，请检查 macOS 隐私设置。' };
  }
}

function createMacMenuTemplate({ appName, showMainWindow, toggleFullscreen, setLyricsEnabled, setLyricsLocked }) {
  return [
    { label: appName, submenu: [
      { role: 'about', label: `关于 ${appName}` },
      { type: 'separator' },
      { role: 'services', label: '服务' },
      { type: 'separator' },
      { role: 'hide', label: `隐藏 ${appName}` },
      { role: 'hideOthers', label: '隐藏其他应用' },
      { role: 'unhide', label: '显示全部' },
      { type: 'separator' },
      { role: 'quit', label: `退出 ${appName}`, accelerator: 'Command+Q' },
    ] },
    { label: '文件', submenu: [
      { role: 'close', label: '关闭窗口', accelerator: 'Command+W' },
    ] },
    { role: 'editMenu', label: '编辑' },
    { label: '显示', submenu: [
      { label: `显示 ${appName}`, click: showMainWindow },
      { label: '切换全屏', accelerator: 'Control+Command+F', click: toggleFullscreen },
      { type: 'separator' },
      { id: 'desktop-lyrics-enabled', label: '桌面歌词', type: 'checkbox', checked: false,
        click: (item) => setLyricsEnabled(item.checked) },
      { id: 'desktop-lyrics-locked', label: '锁定桌面歌词', type: 'checkbox', checked: true, enabled: false,
        click: (item) => setLyricsLocked(item.checked) },
    ] },
    { role: 'windowMenu', label: '窗口', submenu: [
      { role: 'minimize', label: '最小化', accelerator: 'Command+M' },
      { role: 'zoom', label: '缩放' },
      { type: 'separator' },
      { role: 'front', label: '前置全部窗口' },
    ] },
  ];
}

module.exports = { desktopCapabilities, mainWindowPlatformOptions, requestSystemCameraPermission, createMacMenuTemplate };
