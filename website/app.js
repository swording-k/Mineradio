'use strict';
const video = document.querySelector('#product-video');
const playButton = document.querySelector('#play-demo');
const motionButton = document.querySelector('#motion-toggle');
const caption = document.querySelector('#scene-caption');
const videoStatus = document.querySelector('#video-status');
const directLink = document.querySelector('#direct-video');
const sceneButtons = [...document.querySelectorAll('[data-scene]')];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const scenes = {
  cover: { file: 'cover-particles', label: '封面粒子', caption: '01 / 封面粒子' },
  lyrics: { file: 'lyric-stage', label: '歌词舞台', caption: '02 / 歌词舞台' },
};
let currentScene = 'cover', loadedScene = '', objectURL = '';
let controller = null, preparation = null, preparingScene = '', wantsPlayback = false;
const mediaURL = key => `assets/demo/${scenes[key].file}.mp4`;
function syncPlayback() {
  const loading = !!controller && wantsPlayback;
  const paused = video.paused || video.ended;
  playButton.hidden = loading || !paused;
  motionButton.textContent = loading ? '取消加载 ×' : (paused ? '播放实录 ↗' : '暂停实录 Ⅱ');
  motionButton.setAttribute('aria-pressed', String(paused && !loading));
  if (paused && !loading && !video.error) videoStatus.textContent = '实录已暂停 · 点击播放，或选择另一种视觉场景。';
}
async function prepareSource(key) {
  if (loadedScene === key) return;
  if (preparingScene === key && preparation && !controller?.signal.aborted) return preparation;
  controller?.abort();
  const request = new AbortController();
  controller = request;
  preparingScene = key;
  videoStatus.textContent = '正在加载短片，载入后开始播放…';
  syncPlayback();
  const timeout = setTimeout(() => request.abort(), 25000);
  // Small demo clips are fetched once in full. Playing a local object URL avoids
  // remote byte-range requests that can stall inside embedded browsers/proxies.
  preparation = (async () => {
    const response = await fetch(mediaURL(key), { signal: request.signal });
    if (!response.ok) throw new Error('Video response unavailable');
    if (Number(response.headers.get('content-length')) > 12 * 1024 * 1024) throw new Error('Video exceeds preview limit');
    const blob = await response.blob();
    if (!blob.size || blob.size > 12 * 1024 * 1024) throw new Error('Invalid preview size');
    if (request.signal.aborted || currentScene !== key) throw new DOMException('Scene changed', 'AbortError');
    const previous = objectURL;
    objectURL = URL.createObjectURL(blob);
    video.src = objectURL;
    video.load();
    if (previous) URL.revokeObjectURL(previous);
    loadedScene = key;
  })();
  try { await preparation; }
  finally {
    clearTimeout(timeout);
    if (controller === request) { controller = null; preparation = null; preparingScene = ''; }
    syncPlayback();
  }
}
async function play() {
  wantsPlayback = true;
  const key = currentScene;
  try {
    await prepareSource(key);
    if (wantsPlayback && currentScene === key) await video.play();
  } catch (_) {
    if (currentScene !== key || !wantsPlayback) return;
    videoStatus.textContent = '内嵌加载未完成，可点“单独播放这段视频”直接打开。';
    playButton.hidden = false;
  }
}
function pause() {
  wantsPlayback = false;
  controller?.abort();
  video.pause();
  syncPlayback();
}
function selectScene(key) {
  const scene = scenes[key];
  if (!scene) return;
  pause();
  currentScene = key;
  video.poster = `assets/demo/${scene.file}.jpg`;
  video.setAttribute('aria-label', `Mineradio Mac 实际播放：${scene.label}`);
  video.querySelector('track').src = `assets/demo/${scene.file}.vtt`;
  caption.textContent = scene.caption;
  directLink.href = mediaURL(key);
  sceneButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scene === key)));
  play();
}
playButton.addEventListener('click', play);
motionButton.addEventListener('click', () => controller || !video.paused ? pause() : play());
sceneButtons.forEach(button => button.addEventListener('click', () => selectScene(button.dataset.scene)));
video.addEventListener('playing', () => { videoStatus.textContent = '正在播放 Mac 实录 · 已静音，可以暂停或切换场景。'; });
video.addEventListener('error', () => { syncPlayback(); videoStatus.textContent = '内嵌播放未能加载，请点“单独播放这段视频”。'; });
for (const event of ['play', 'pause', 'ended']) video.addEventListener(event, syncPlayback);
reducedMotion.addEventListener('change', event => { if (event.matches) pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { controller?.abort(); if (objectURL) URL.revokeObjectURL(objectURL); objectURL = ''; loadedScene = ''; });
syncPlayback();
if (!reducedMotion.matches && !navigator.connection?.saveData) play();
