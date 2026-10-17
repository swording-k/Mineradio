# Mineradio community product website

Static HTML/CSS/JS, deployed from `website/` by GitHub Pages. No analytics,
external font service or added frontend framework.

Preview: `python3 -m http.server 4173 --bind 127.0.0.1 --directory website`.

## Actual recordings

The two source recordings were supplied by the project owner from their Mac:

- `录屏2026-10-17 17.42.46.mov`: 8.5–22.5 seconds → cover particles.
- `录屏2026-10-17 17.44.13.mov`: 0.45–5.10 seconds → lyric stage.

Raw recordings remain outside Git. Web clips are cropped from 2940×1912 to
2940×1848 (remove top 64 px), with the account region obscured, audio removed,
and H.264 / yuv420p / fast-start compressed to 1280 px wide at 24 fps. Recording
selection controls are excluded. Product animation is neither redrawn nor sped
up. JPEG posters and descriptive VTT captions accompany the clips.

The viewer uses standard HTML video with an actual HTML source URL, so the native
controls work even if enhancement JavaScript cannot load. Direct MP4 links remain
available. Script and stylesheet URLs carry deployment versions to avoid mixing
old cached scripts with new markup. The viewer uses standard HTML video. Muted autoplay is attempted only without
reduced-motion or save-data preference. User controls remain available. Hidden
pages pause playback. Switching scenes loads only the selected clip.

## Downloads are separate from site deployments

Mac download provides `v2.2.0-community.3`; Windows links directly to upstream
`XxHuberrr/Mineradio-paused` v2.2.0. The recordings show the owner's actual Mac
runtime and do not establish feature parity or stability of either public package.

The user explicitly authorized this Mac preview with the Qishui fix. Keep its
official-client dependency and remaining stability/signing limitations visible.
Windows keeps the original upstream package until its own acceptance.

The enhanced viewer loads each short MP4 with a bounded full-file fetch before
playing a local object URL. This avoids observed embedded-browser remote range
requests stalling after the initial 229376 bytes, while direct HTTP range probes
succeed. Loading is cancelable (25-second timeout; 12 MiB maximum clip), stale
scene requests abort, and old object URLs are revoked. Only the selected scene
is held. HTML/direct-file fallbacks remain available without enhancement JS.
