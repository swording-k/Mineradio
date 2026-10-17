# Real product demos and cross-platform delivery

Goal: replace the illustrative homepage with actual Mac playback recordings,
while keeping public installer versions unchanged and introducing traceable work.

- Use the owner's two 2026-10-17 recordings. Extract a clean cover-particle scene
  and lyric-stage scene; crop system chrome, hide account names/avatars, remove
  audio and recording controls, encode H.264 with fast start and static posters.
- Build one dark, full-width product viewer with two scenes and native controls.
  No invented player UI, synthetic particles or unsupported product promises.
  Autoplay is muted and optional; reduced-motion/data-saving users get a poster.
- Keep macOS community.2 and upstream Windows 2.2.0 download links. New Mac Qishui
  work stays on its fix branch and draft release until stability acceptance.
- Reuse GitHub Issues, milestones, PR templates and Actions; retain one shared
  main branch and short-lived issue branches. No new management service/runtime.
- Run shared checks on native Windows and macOS runners. Build candidates only
  on explicit workflow dispatch; never auto-publish desktop installers.
- Verify both scenes, pause/resume, mobile layout, keyboard accessibility, source
  and download links locally; then publish and verify the website only.

Sources: existing Electron scripts, GitHub Actions matrix documentation,
electron-builder multi-platform guidance. Native OS tests remain distinct from
packaging and unit checks. See docs/DEVELOPMENT.md for the operating workflow.
