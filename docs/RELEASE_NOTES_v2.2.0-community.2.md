# Mineradio 2.2.0 community.2

Apple Silicon macOS community preview; based on upstream 2.2.0.

## Changes

- Restore native macOS full-screen capability. The real application now enters
  full screen, covers the display's usable area, and restores its window.
- Avoid the second MusicTempo pass during automatic playback analysis. The
  existing four-band beat analysis remains available; manual tempo analysis
  uses at most 90 seconds of PCM at 22,050 Hz, and obsolete workers terminate
  after a track switch. This reduces a confirmed source of memory pressure;
  it does not establish that every reported crash has been fixed.
- Fall back to Qishui's public track endpoint when desktop metadata is empty.
  Validate the track identity, preserve full-track membership checks, and accept
  a public audition only when its explicit duration matches the returned stream.
- Explain Qishui public previews as an interface limitation, rather than
  incorrectly telling a verified VIP member that they lack membership.
- Add the original author's Windows installer to the product website, with
  upstream attribution and a direct link to its original release.

## Known limitations

- **Qishui VIP full-track playback remains unresolved.** Account membership is
  verified correctly, but the desktop playback endpoint still returns HTTP 200
  with an empty body. The public endpoint may offer only 30/60-second auditions,
  even for a VIP. A local experiment with the installed official Mac client's
  signature module also returned empty playback metadata. That experimental
  bridge and all proprietary components are excluded from this release.
- Renderer crash reports were symbolicated as native allocation failures. The
  beat-worker lifecycle and resource limits are mitigations; continued runtime
  validation is required before claiming the original crash is resolved.
- Native automated local-audio and full-screen checks pass. The broader macOS
  lifecycle smoke test still stops at native minimization; later lifecycle
  checks are therefore not claimed as passed.
- Developer ID signed and timestamped; Apple notarization is not complete.
- iPad, iPhone and Intel Mac community installers are not provided.

The original copyright notices and GPL-3.0-only license remain in force.
