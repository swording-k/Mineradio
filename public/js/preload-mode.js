// Read the trusted desktop bridge before the page paints. Browser previews and
// older Windows builds keep their existing behavior when no platform is given.
function isMacDesktop() {
  return !!(window.desktopWindow && window.desktopWindow.isDesktop && window.desktopWindow.platform === 'darwin');
}
function desktopFeatureAvailable(feature) {
  var api = window.desktopWindow;
  if (!api || !api.isDesktop) return true;
  if (api.capabilities && typeof api.capabilities[feature] === 'boolean') return api.capabilities[feature];
  if (/^(fullDesktopMode|wallpaperEngine|desktopLyricsGlobalMouseToggle|systemMemoryPurge)$/.test(feature) && api.platform) {
    return api.platform === 'win32';
  }
  return true;
}
function desktopLyricsLockHint() {
  return desktopFeatureAvailable('desktopLyricsGlobalMouseToggle')
    ? '锁定后防误触；鼠标移到桌面歌词上按中键可锁定/解锁'
    : '锁定后防误触；可在此处或菜单栏「显示」菜单中锁定 / 解锁桌面歌词';
}
function applyDesktopPlatformUi() {
  document.querySelectorAll('[data-desktop-feature]').forEach(function (node) {
    node.classList.toggle('desktop-feature-unavailable', !desktopFeatureAvailable(node.getAttribute('data-desktop-feature')));
  });
  var lock = document.getElementById('t-desktopLyricsClickThrough');
  if (lock) lock.title = desktopLyricsLockHint();
  if (isMacDesktop()) {
    var memoryNote = document.getElementById('memory-status-sub');
    if (memoryNote) memoryNote.textContent = '隐藏窗口后自动回收播放器资源；系统内存由 macOS 管理。';
  }
}
if (isMacDesktop()) document.documentElement.classList.add('desktop-platform-mac');
document.addEventListener('DOMContentLoaded', applyDesktopPlatformUi, { once: true });

try {
  if (localStorage.getItem('mineradio-startup-fast-skip-v1') === '1') {
    document.documentElement.classList.add('startup-fast-skip-preload');
  }
  document.documentElement.classList.add(localStorage.getItem('mineradio-diy-player-mode-v1') === '1' ? 'diy-mode-preload' : 'simple-mode-preload');
} catch (e) {
  document.documentElement.classList.add('simple-mode-preload');
}
