'use strict';
const motionButton = document.querySelector('#motion-toggle');
const visual = document.querySelector('.hero-visual');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
function setPaused(paused) {
  visual.classList.toggle('motion-paused', paused);
  motionButton.setAttribute('aria-pressed', String(paused));
  motionButton.textContent = paused ? '▶ 播放动效' : 'Ⅱ 暂停动效';
}
setPaused(reducedMotion.matches);
motionButton.addEventListener('click', () => setPaused(motionButton.getAttribute('aria-pressed') !== 'true'));
reducedMotion.addEventListener('change', event => setPaused(event.matches));
