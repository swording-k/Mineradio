'use strict';
const video = document.querySelector('#product-video');
const playButton = document.querySelector('#play-demo');
const motionButton = document.querySelector('#motion-toggle');
const caption = document.querySelector('#scene-caption');
const sceneButtons = [...document.querySelectorAll('[data-scene]')];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const scenes = {
  cover: { file: 'cover-particles', label: '封面粒子', caption: '01 / 封面粒子' },
  lyrics: { file: 'lyric-stage', label: '歌词舞台', caption: '02 / 歌词舞台' },
};
let currentScene = 'cover';
function syncPlayback() {
  const paused = video.paused || video.ended;
  playButton.hidden = !paused;
  motionButton.textContent = paused ? '播放实录 ↗' : '暂停实录 Ⅱ';
  motionButton.setAttribute('aria-pressed', String(paused));
}
async function play() {
  if (!video.getAttribute('src')) {
    video.src = `assets/demo/${scenes[currentScene].file}.mp4`;
  }
  try { await video.play(); }
  catch (_) { syncPlayback(); }
}
function selectScene(key) {
  const scene = scenes[key];
  if (!scene) return;
  currentScene = key;
  video.pause();
  video.poster = `assets/demo/${scene.file}.jpg`;
  video.src = `assets/demo/${scene.file}.mp4`;
  video.setAttribute('aria-label', `Mineradio Mac 实际播放：${scene.label}`);
  video.querySelector('track').src = `assets/demo/${scene.file}.vtt`;
  caption.textContent = scene.caption;
  sceneButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scene === key)));
  video.load();
  play();
}
playButton.addEventListener('click', play);
motionButton.addEventListener('click', () => video.paused ? play() : video.pause());
sceneButtons.forEach(button => button.addEventListener('click', () => selectScene(button.dataset.scene)));
for (const event of ['play', 'pause', 'ended', 'error']) video.addEventListener(event, syncPlayback);
reducedMotion.addEventListener('change', event => { if (event.matches) video.pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); });
syncPlayback();
if (!reducedMotion.matches && !navigator.connection?.saveData) play();
