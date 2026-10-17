'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const https = require('node:https');
const { EventEmitter } = require('node:events');
const qishui = require('../qishui-api');

function mockRequests(t, handler) {
  const original = https.request;
  https.request = (target, options, callback) => {
    const request = new EventEmitter();
    request.setTimeout = () => request;
    request.write = () => {};
    request.destroy = error => request.emit('error', error);
    request.end = () => Promise.resolve().then(() => handler(new URL(target), options)).then(result => {
      const response = new EventEmitter();
      response.statusCode = result.statusCode || 200;
      response.headers = {};
      callback(response);
      response.emit('data', Buffer.from(typeof result.body === 'string' ? result.body : JSON.stringify(result.body)));
      response.emit('end');
    }).catch(error => request.emit('error', error));
    return request;
  };
  t.after(() => { https.request = original; });
}

const cookie = 'sessionid=synthetic-session; sid_tt=synthetic-session';
const expired = { status_code: 1000016, status_info: { status_msg: '登录状态已失效，请重新登录' } };
const validProfile = { data: { my_info: { id: 'synthetic-user', nickname: 'Fixture' }, is_vip: false } };

test.beforeEach(() => qishui._test.clearQishuiRuntimeCaches());

function seoFixture(id, { vip = false, audition = 0, duration = 180 } = {}) {
  return { seo_track: { track: { id, duration_ms: 180000,
    label_info: { only_vip_playable: vip }, audition_info: { duration_ms: audition * 1000 },
    track_player: { video_model: JSON.stringify({ video_duration: duration, video_list: [
      { main_url: Buffer.from('https://media.example/public.m4a').toString('base64'),
        video_meta: { bitrate: 64000, format: 'aac', gear_des_key: 'medium' } },
    ] }) },
  } } };
}

test('empty desktop metadata falls back to matching public full audio', async t => {
  mockRequests(t, url => {
    if (url.pathname === '/luna/pc/me') return { body: validProfile };
    if (url.pathname === '/luna/h5/seo_track') return { body: seoFixture('public-full') };
    return { body: '' };
  });
  const result = await qishui.handleQishuiSongUrl({ id: 'public-full' }, cookie);
  assert.equal(result.playable, true);
  assert.equal(result.trial, false);
  assert.equal(result.source, 'qishui-public-seo-track');
  assert.equal(result.duration, 180);
});

test('public VIP previews require explicit audition metadata and never expose full VIP audio', async t => {
  let fixture = seoFixture('public-vip', { vip: true, audition: 30, duration: 30 });
  mockRequests(t, url => {
    if (url.pathname === '/luna/pc/me') return { body: validProfile };
    if (url.pathname === '/luna/h5/seo_track') return { body: fixture };
    return { body: '' };
  });
  const trial = await qishui.handleQishuiSongUrl({ id: 'public-vip' }, cookie);
  assert.equal(trial.playable, true);
  assert.equal(trial.trial, true);
  assert.equal(trial.duration, 30);
  qishui._test.clearQishuiRuntimeCaches();
  fixture = seoFixture('public-vip', { vip: true, audition: 30, duration: 180 });
  const full = await qishui.handleQishuiSongUrl({ id: 'public-vip' }, cookie);
  assert.equal(full.playable, false);
  assert.equal(full.reason, 'vip_required');
  assert.equal(full.url || '', '');
  qishui._test.clearQishuiRuntimeCaches();
  fixture = seoFixture('public-vip', { vip: true, duration: 30 });
  assert.equal((await qishui.handleQishuiSongUrl({ id: 'public-vip' }, cookie)).playable, false);
});

test('public fallback rejects mismatched tracks and does not run after explicit session expiry', async t => {
  let seoCalls = 0, sessionExpired = false;
  mockRequests(t, url => {
    if (url.pathname === '/luna/pc/me') return { body: sessionExpired ? expired : validProfile };
    if (url.pathname === '/luna/h5/seo_track') { seoCalls++; return { body: seoFixture('wrong-id') }; }
    return { body: '' };
  });
  assert.equal((await qishui.handleQishuiSongUrl({ id: 'requested' }, cookie)).playable, false);
  assert.equal(seoCalls, 1);
  qishui._test.clearQishuiRuntimeCaches();sessionExpired = true;
  assert.equal((await qishui.handleQishuiSongUrl({ id: 'requested' }, cookie)).reason, 'login_required');
  assert.equal(seoCalls, 1);
});

test('expired official session cannot become a successful status or an empty synchronized library', async t => {
  let requests = 0;
  mockRequests(t, url => {
    requests++;
    assert.equal(url.pathname, '/luna/pc/me', 'expired identity must stop dependent library calls');
    return { body: expired };
  });
  const status = await qishui.handleQishuiStatus(cookie);
  assert.equal(status.loggedIn, false);
  assert.equal(status.webSession, false);
  assert.equal(status.reauthRequired, true);
  assert.equal(status.stale, false);
  assert.equal(status.libraryReady, false);
  assert.equal(status.membershipKnown, false);
  assert.equal(status.vipLevel, 'unknown');
  assert.equal(status.capabilities.playableUrl, false);
  assert.equal(status.cookieReady, true, 'a failed read must preserve the saved credential');
  const library = await qishui.handleQishuiUserPlaylists(cookie);
  assert.equal(library.loggedIn, false);
  assert.equal(library.reauthRequired, true);
  assert.deepEqual(library.playlists, []);
  assert.equal(requests, 2, 'failed identity results must not be cached for 90 seconds');
});

test('a transient profile failure stays unknown and immediately recovers on retry', async t => {
  let fail = true;
  mockRequests(t, url => {
    if (url.pathname === '/luna/pc/me') return fail
      ? { statusCode: 503, body: {} }
      : { body: validProfile };
    return { body: { status_code: 0, data: {} } };
  });
  const failed = await qishui.handleQishuiStatus(cookie);
  assert.equal(failed.stale, true);
  assert.equal(failed.reauthRequired, false);
  assert.equal(failed.loggedIn, false);
  assert.equal(failed.vipLevel, 'unknown');
  fail = false;
  const recovered = await qishui.handleQishuiStatus(cookie);
  assert.equal(recovered.loggedIn, true);
  assert.equal(recovered.sessionValidated, true);
  assert.equal(recovered.libraryReady, true);
  assert.equal(recovered.stale, false);
});

test('HTTP 200 with missing account identity cannot validate saved cookies', async t => {
  mockRequests(t, () => ({ body: { status_code: 0, data: {} } }));
  const status = await qishui.handleQishuiStatus(cookie);
  assert.equal(status.loggedIn, false);
  assert.equal(status.error, 'QISHUI_PROFILE_INCOMPLETE');
  assert.equal(status.stale, true);
});

test('personal playlists load without waiting for recommendation feeds and partial failures are retried', async t => {
  let collectionRequests = 0;
  mockRequests(t, url => {
    assert.doesNotMatch(url.pathname, /feed/);
    if (url.pathname === '/luna/pc/me') return { body: validProfile };
    if (url.pathname === '/luna/pc/me/collection/mixed' && ++collectionRequests === 1) return { statusCode: 503, body: {} };
    return { body: { status_code: 0, data: {} } };
  });
  const partial = await qishui.handleQishuiUserPlaylists(cookie);
  assert.equal(partial.loggedIn, true);
  assert.equal(partial.libraryReady, false);
  assert.equal(partial.libraryErrors.length, 1);
  const recovered = await qishui.handleQishuiUserPlaylists(cookie);
  assert.equal(recovered.libraryReady, true);
  assert.equal(collectionRequests, 2);
});

test('empty PC responses keep public search available but identify an expired playback session', async t => {
  mockRequests(t, url => {
    if (url.pathname === '/luna/pc/me') return { body: expired };
    if (url.pathname === '/v2/search/type') return { body: { data: { list: [{ item_id: 'public-fixture', title: '恢复测试' }] } } };
    return { body: '' };
  });
  const search = await qishui.handleQishuiSearch('恢复测试', 2, cookie);
  assert.equal(search.songs.length, 1);
  assert.equal(search.publicCatalog, true);
  assert.equal(search.loggedIn, false);
  assert.equal(search.reauthRequired, true);
  assert.doesNotMatch(search.pcSearchError, /Invalid JSON/);
  const playback = await qishui.handleQishuiSongUrl({ id: 'public-fixture' }, cookie);
  assert.equal(playback.playable, false);
  assert.equal(playback.reason, 'login_required');
  assert.equal(playback.reauthRequired, true);
});

test('a failed player-info resolution retries immediately and cached audio cannot override stricter rights', async t => {
  let playerRequests = 0;
  mockRequests(t, url => {
    if (url.pathname === '/luna/pc/me') return { body: validProfile };
    if (url.pathname === '/luna/pc/track_v2') return { body: { data: {
      track: { id: 'recover-stream', duration_ms: 180000 },
      track_player: { url_player_info: 'https://media.example/player-info' },
    } } };
    if (url.pathname === '/player-info') {
      playerRequests++;
      if (playerRequests === 1) return { statusCode: 503, body: {} };
      return { body: { Result: { Data: { PlayInfoList: [{ MainPlayUrl: 'https://media.example/recovered.m4a', Duration: 180, Bitrate: 128000 }] } } } };
    }
    throw new Error('Unexpected request');
  });
  const first = await qishui.handleQishuiSongUrl({ id: 'recover-stream' }, cookie);
  assert.equal(first.playable, false);
  const second = await qishui.handleQishuiSongUrl({ id: 'recover-stream' }, cookie);
  assert.equal(second.playable, true);
  assert.equal(playerRequests, 2);
  const restricted = await qishui.handleQishuiSongUrl({ id: 'recover-stream', need_vip: true }, cookie);
  assert.equal(restricted.playable, false);
  assert.equal(restricted.reason, 'vip_required');
});

test('playback settles under a wall-clock deadline even when DNS or the response never emits an event', async t => {
  const originalRequest = https.request;
  const originalTimer = global.setTimeout;
  const deadlines = [];
  global.setTimeout = (callback, delay, ...args) => {
    deadlines.push(delay);
    return originalTimer(callback, 5, ...args);
  };
  https.request = () => {
    const request = new EventEmitter();
    request.write = () => {};
    request.end = () => {};
    request.destroy = error => request.emit('error', error);
    return request;
  };
  t.after(() => { https.request = originalRequest; global.setTimeout = originalTimer; });
  const result = await qishui.handleQishuiSongUrl({ id: 'never-connects' }, cookie);
  assert.equal(result.playable, false);
  assert.equal(result.stale, true);
  assert.deepEqual(deadlines, [3000, 3000, 2500, 3000]);
  assert.doesNotMatch(result.message, /Invalid JSON/);
});

test('an explicit numeric end-of-search flag stops pagination even when the final page is full', async t => {
  mockRequests(t, () => ({ body: { data: {
    result_groups: [{ data: [{ entity: { track_wrapper: { track: { base_info: { id: 'final-page', name: '末页' } } } } }] }],
    has_more: 0,
  } } }));
  const result = await qishui.handleQishuiSearch('末页', 1, cookie);
  assert.equal(result.songs.length, 1);
  assert.equal(result.hasMore, false);
});
