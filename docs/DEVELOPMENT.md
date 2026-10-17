# Development and platform validation

## One repository, platform adapters

Keep one shared `main` branch. Use short-lived `fix/<issue>-description`,
`feat/<issue>-description` or `site/<description>` branches and PRs. Do not keep
permanent Mac and Windows branches: fixes to shared playback/UI would otherwise
need repeated merging and diverge.

Shared UI, queue and provider logic remain common. Native window behavior,
permissions, tray, lyrics overlays, system integration and signing belong in
platform capability/adaptor modules. Platform-specific work must be gated by the
actual OS. For example, the pending Mac Qishui adapter enters only on `darwin`;
Windows keeps its existing request path. Shared-file changes still require both
OS checks, including unaffected fallback behavior.

An independent future Swift iOS app may live under a separate app directory,
with shared API/contracts, or split later if ownership and release cycles warrant
it. Do not create empty iOS repositories merely to match device names.

## Work record and merge flow

1. Create/find an Issue for each independent bug or feature. Record platform,
   app/system versions, reproduction, expected behavior and acceptance criteria.
2. Work on an issue branch. Each commit expresses a coherent purpose; Git records
   the author, time and diff automatically. Do not manually duplicate every diff.
3. Open a PR referencing the Issue, with root cause, platform impact, actual
   checks, pending native acceptance and intended delivery. Use `Refs #N` while
   acceptance remains pending; merge alone does not mean a user's bug is resolved.
4. Run `npm test` and `npm run check`. The `Desktop CI` workflow runs these on
   native Windows and macOS runners for code changes. Docs/website-only changes
   do not trigger desktop checks. CI logs are the evidence, not this document.
5. Native playback, window lifecycle, audio/GPU and account behavior require
   actual target-OS testing. Update the Issue with results; retain open status
   while required acceptance is outstanding.
6. Package a candidate on the target runner. Use the manual `Desktop CI` input
   `build_candidates=true` to store unsigned QA packages as 14-day Actions
   artifacts. This does not create a public Release or change the website.
7. Promote only after the release gate below and explicit user authorization.

Use the [Mac acceptance milestone](https://github.com/swording-k/Mineradio/milestone/1)
and [Issues](https://github.com/swording-k/Mineradio/issues) as the active tracker.
Prioritize via labels and milestone; docs retain release facts and decisions.

## Windows: work without reinstalling every edit

A new ChatGPT conversation is optional. This conversation can coordinate Issues,
source changes, PRs and CI. Running Windows UI needs a connected Windows machine
or a local tester; another conversation is useful only as a separate workstation
context, using the same Issue/PR as handoff.

On a Windows machine/VM, clone this repository once. For the selected test branch:

```powershell
git fetch origin
git switch <branch-name>
git pull --ff-only
npm ci
npm start
```

Restart the app after source updates; rerun `npm ci` when the lockfile changes.
Use a separate disposable test profile for automated tests. Log into music
platforms on the test machine; never put personal cookies in GitHub or CI.

For code checks and a candidate installer on Windows:

```powershell
npm test
npm run check
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
npm run build:win -- --x64 --publish never
```

Native behavior may additionally be exercised with
`npm run check -- --electron`, which includes the repository's existing runtime
smokes. Audit their OS skips and machine-specific paths before claiming success.
CI packaging/checks do not establish audio, graphics or account UX correctness.

On this Mac, editing Windows code and simulated `win32` unit tests are possible;
running Win32 APIs is not. The current `build/after-pack.js` directly invokes
`rcedit-x64.exe`, so do not assume a local Mac `build:win` works. Prefer the
Windows runner over adding Wine to this machine merely for packaging.

An Apple Silicon Windows ARM VM is useful for interaction testing but differs
from Windows x64 hardware, graphics and native modules. Record it as ARM/VM and
retain Windows x64 CI plus target-device validation before a Windows stable
release. Installation/upgrade/uninstall are tested on candidates, not each edit.

## Stable release gate (per platform)

- Relevant shared tests and native-OS CI checks pass for the exact source commit.
- Confirm import/play/pause/seek/next, user login and expected entitlements,
  full screen/minimize/restore, restart and sleep recovery on the target OS.
- At least 30 minutes of representative playback with effects and track changes;
  record physical memory and renderer failures. A quiet run is evidence for that
  configuration, not proof every crash is fixed.
- Verify fresh install, upgrade preserving data, uninstall and rollback.
- Record platform/architecture, signing and notarization separately. Keep unsigned
  CI artifacts internal; final Mac distribution uses the owner's Developer ID.
- Release includes exact tag/commit, checksums, corresponding source and known
  issues. Mac and Windows may release on different schedules. Preserve each
  platform's last accepted download until its replacement passes acceptance.

The current explicit hold is recorded in `docs/RELEASE_STATUS.md`.

## Official references

- [electron-builder: multi-platform builds](https://www.electron.build/v26/docs/features/multi-platform-build/)
- [GitHub Actions: job matrices](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/run-job-variations)
- [Electron: automated testing](https://www.electronjs.org/docs/latest/tutorial/automated-testing)
