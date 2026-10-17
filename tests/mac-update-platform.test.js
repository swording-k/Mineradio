'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const releaseUrl = 'https://github.com/fixture/Mineradio/releases/tag/v2.3.0';
const windowsPage = 'https://example.invalid/windows-download';
const asset = name => ({ name, browser_download_url: `${releaseUrl.replace('/tag/', '/download/')}/${name}` });

function harness(platform = 'darwin', arch = 'arm64') {
  const context = vm.createContext({
    URL, AbortController, setTimeout, clearTimeout,
    process: { platform, arch },
    APP_VERSION: '2.2.0', UPDATE_FALLBACK_NOTES: ['新版本'],
    UPDATE_CONFIG: { configured: true, provider: 'github', owner: 'fixture', repo: 'Mineradio' },
  });
  const helpersStart = source.indexOf('function normalizeVersion(');
  const helpersEnd = source.indexOf('async function readUpdateManifest(', helpersStart);
  const fetchStart = source.indexOf('function yamlScalar(');
  const fetchEnd = source.indexOf('function readRequestBody(', fetchStart);
  assert(helpersStart >= 0 && helpersEnd > helpersStart && fetchStart >= 0 && fetchEnd > fetchStart);
  vm.runInContext(source.slice(helpersStart, helpersEnd) + '\n' + source.slice(fetchStart, fetchEnd), context);
  return context;
}

async function checkRelease(context, assets) {
  context.fetch = async () => ({
    ok: true,
    json: async () => ({
      tag_name: 'v2.3.0', html_url: releaseUrl, assets,
      body: `- 修复播放\n<!-- mineradio-download-page: 网盘下载|${windowsPage} -->`,
    }),
  });
  return context.fetchLatestUpdateInfo();
}

test('macOS selects its CPU architecture and prefers DMG while excluding Windows pages and assets', async () => {
  const assets = [
    asset('Mineradio-2.3.0-Setup.exe'), asset('Mineradio-2.3.0-win-x64.zip'),
    asset('Mineradio-2.3.0-mac-universal.zip'), asset('Mineradio-2.3.0-mac-x64.dmg'),
    asset('Mineradio-2.3.0-mac-arm64.zip'), asset('Mineradio-2.3.0-mac-arm64.dmg'),
  ];
  for (const arch of ['arm64', 'x64']) {
    const result = await checkRelease(harness('darwin', arch), assets);
    assert.equal(result.updateAvailable, true);
    assert.equal(result.release.platform, 'darwin');
    assert.equal(result.release.arch, arch);
    assert.equal(result.release.compatible, true);
    assert.match(result.release.externalUrl, new RegExp(`mac-${arch}\\.dmg$`));
    assert.equal(result.release.downloadPageUrl, result.release.externalUrl);
    assert(result.release.downloadPages.some(page => page.url.endsWith('mac-universal.zip')));
    assert(result.release.downloadPages.every(page => !page.url.includes(windowsPage) && !page.url.includes('win-x64')));
    assert(result.release.downloadPages.every(page => !page.url.includes(arch === 'arm64' ? 'mac-x64' : 'mac-arm64')));
    assert.equal(result.release.asset, null);
    assert.equal(result.release.patchAvailable, false);
  }
});

test('macOS rejects ambiguous or incompatible assets and offers only the Release page', async () => {
  for (const assets of [undefined, [], [
    asset('Mineradio-2.3.0-Setup.exe'), asset('Mineradio-2.3.0-win-arm64.zip'),
    asset('Mineradio-2.3.0-linux-arm64.zip'), asset('Mineradio-2.3.0-mac-x64.dmg'),
    asset('Mineradio-2.3.0.dmg'), asset('Mineradio-2.3.0-arm64.zip'),
    asset('Mineradio-2.3.0-mac-arm64-x64.dmg'),
    { name: 'Mineradio-mac-arm64.dmg', browser_download_url: 'http://example.invalid/Mineradio-mac-arm64.dmg' },
  ]]) {
    const result = await checkRelease(harness(), assets);
    assert.equal(result.release.compatible, false);
    assert.equal(result.release.externalUrl, '');
    assert.equal(result.release.downloadUrl, '');
    assert.equal(result.release.downloadPages.length, 0);
    assert.equal(result.release.downloadPageUrl, releaseUrl);
    assert.match(result.release.summary, /暂无.*macOS.*Apple Silicon/);
  }
});

test('Windows keeps the upstream external download pages', async () => {
  const result = await checkRelease(harness('win32', 'x64'), [asset('Mineradio-mac-x64.dmg')]);
  assert.equal(result.release.externalUrl, windowsPage);
  assert.equal(result.release.downloadPages.length, 1);
  assert.equal(result.release.asset, null);
});

test('Mac manifests accept explicit platform and architecture, retire old links, and deduplicate assets', () => {
  const context = harness();
  const url = 'https://example.invalid/Mineradio.zip';
  const info = context.normalizeManifestUpdateInfo({
    version: '2.3.0', externalUrl: windowsPage,
    release: {
      htmlUrl: releaseUrl,
      downloadPages: [
        { url, platform: 'darwin', arch: 'arm64' },
        { url, platform: 'darwin', arch: 'arm64' },
        { url: 'https://example.invalid/Windows-arm64.zip', platform: 'win32', arch: 'arm64' },
      ],
    },
  });
  assert.equal(info.release.compatible, true);
  assert.equal(info.release.externalUrl, url);
  assert.equal(info.release.downloadPages.length, 1);
  const empty = context.normalizeManifestUpdateInfo({ version: '2.3.0', externalUrl: windowsPage, release: { downloadPages: [] } });
  assert.equal(empty.release.compatible, false);
  assert.equal(empty.release.externalUrl, '');
  assert.equal(empty.release.downloadPageUrl, 'https://github.com/fixture/Mineradio/releases');
});

test('Mac update fallback requests latest-mac.yml and avoids unverified installer links', async () => {
  const context = harness();
  const requested = [];
  context.fetch = async () => ({ ok: false, status: 403 });
  context.uniqueDownloadCandidates = url => [{ url }];
  context.fetchTextFromCandidates = async candidates => {
    requested.push(candidates[0].url);
    return { text: 'version: 2.3.0\npath: Mineradio-2.3.0-Setup.exe\nreleaseDate: 2026-09-07' };
  };
  const result = await context.fetchLatestUpdateInfo();
  assert.equal(requested.length, 1);
  assert.match(requested[0], /\/latest-mac\.yml$/);
  assert.equal(result.updateAvailable, true);
  assert.equal(result.release.compatible, false);
  assert.equal(result.release.downloadPageUrl, releaseUrl);
  assert.equal(result.release.externalUrl, '');
});

test('Mac fallback rejects installer URLs disguised as a Release page', () => {
  for (const htmlUrl of ['https://example.invalid/Mineradio-Setup.exe', 'https://github.com/fixture/Mineradio/releases/download/v2.3.0/Mineradio-Setup.exe']) {
    const result = harness().normalizeManifestUpdateInfo({ version: '2.3.0', release: { htmlUrl } });
    assert.equal(result.release.compatible, false);
    assert.equal(result.release.htmlUrl, 'https://github.com/fixture/Mineradio/releases');
    assert.equal(result.release.downloadPageUrl, result.release.htmlUrl);
  }
});

test('Mac assets reject unsupported and contradictory explicit architectures', () => {
  const context = harness();
  for (const arch of ['ia32', 'x64', 'universal']) {
    const result = context.normalizeManifestUpdateInfo({ version: '2.3.0', release: { assets: [{
      ...asset('Mineradio-mac-arm64.dmg'), platform: 'darwin', arch,
    }] } });
    assert.equal(result.release.compatible, false);
    assert.equal(result.release.externalUrl, '');
  }
});
