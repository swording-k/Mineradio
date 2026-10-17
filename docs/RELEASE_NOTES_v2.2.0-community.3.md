# Mineradio 2.2.0 community.3

Apple Silicon macOS community preview, based on upstream 2.2.0.

- Restore Qishui full-track playback for an authenticated, entitled account using
  the matching Mac 2.9.1 request contract and the locally installed official
  client's signature component. Previously mismatched Windows request parameters
  produced empty responses and fell back to public 30-second auditions.
- No official client binaries are redistributed. This integration requires the
  official Qishui Mac app **2.9.1** in `/Applications` or `~/Applications`, plus
  an active Qishui login and applicable membership in Mineradio. The official
  app need not be running or logged in. Other official-client versions are not
  yet supported; unavailable integration retains the public preview fallback.
- Actual playback verification: “Love You Down” played naturally past 45 seconds,
  then continued after seeking past two minutes, using the Qishui provider.
- Retain the full-screen and analysis resource improvements from community.2.

## Remaining limitations

Developer ID signed; Apple notarization is not complete. The original reported
memory crash requires continued observation; the broader native lifecycle smoke
check still has a minimization failure. iPhone/iPad and Intel Mac installers are
not provided.

The current “汽水推荐” entry is a finite batch, at most 50 tracks, without feed
continuation. When the recommendation endpoint is unavailable it combines liked,
recent and existing playlist tracks. It is not an infinite recommendation radio;
provider-specific navigation needs a separate design pass.

The original copyright notices and GPL-3.0-only license remain in force.
