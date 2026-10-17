# Release status

Snapshot: 2026-10-17. GitHub Release assets/tags and linked Issue evidence are the
current distribution and acceptance records; update this snapshot at promotion.

| Channel | Source / package | Status |
| --- | --- | --- |
| Public macOS | `v2.2.0-community.2`, source `9e839e8`, Apple Silicon | Existing signed preview; not notarized. Website remains on this version. |
| Local macOS candidate | branch `fix/qishui-full-playback`, commit `26fc655` | Installed on owner's Mac. Qishui Mac 2.9.1 dependency, tests and real full playback verified. Long-run/user acceptance and Windows regression pending. |
| community.3 Release | tag `v2.2.0-community.3` | **Draft only.** Upload interrupted at user's request. Not stable, not a public download. |
| Public Windows | upstream `XxHuberrr/Mineradio-paused` v2.2.0 | Original upstream EXE; this community has not performed Windows native acceptance. |
| iPad / iPhone | none | Not implemented or distributed. |

The user explicitly requested holding new installers until stability acceptance.
Website recording/layout updates are independent and may publish without changing
the two current download versions. Never promote an installer merely because a
website is ready or a build is green.

## Acceptance tracking

- [#1 Qishui VIP full playback](https://github.com/swording-k/Mineradio/issues/1):
  local fix; verify common playlists, prolonged playback and platform isolation.
- [#2 memory pressure / crash](https://github.com/swording-k/Mineradio/issues/2):
  mitigation shipped, original crash not yet conclusively resolved.
- [#3 native window lifecycle](https://github.com/swording-k/Mineradio/issues/3):
  full-screen check passed; minimization check and broader lifecycle pending.
- [#4 recommendation semantics](https://github.com/swording-k/Mineradio/issues/4):
  product backlog, not an implemented infinite feed.
- [#5 Windows baseline](https://github.com/swording-k/Mineradio/issues/5):
  shared CI, Windows candidate build and native QA tracked separately.
- [#6 real website demos](https://github.com/swording-k/Mineradio/issues/6):
  recordings/layout only; preserve installer versions.

No above Issue is resolved solely by creating it or merging code. Actual native
results and published version determine when a playback/window issue can close.
