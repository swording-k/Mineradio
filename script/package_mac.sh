#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
APP_VERSION="$(node -p 'require("./package.json").version')"
DMG="dist/Mineradio-${APP_VERSION}-mac-arm64.dmg"
ZIP="dist/Mineradio-${APP_VERSION}-mac-arm64.zip"

case "${1:-preview}" in
  preview)
    npm run build:mac:arm64
    ;;
  signed)
    : "${CSC_NAME:?Set CSC_NAME to your authorized Developer ID identity name}"
    SIGNING_NAME="${CSC_NAME#Developer ID Application: }"
    npx electron-builder --mac dmg zip --arm64 --publish never \
      "-c.mac.identity=$SIGNING_NAME" -c.mac.hardenedRuntime=true -c.mac.notarize=false
    ;;
  notarized)
    : "${CSC_NAME:?Set CSC_NAME to your authorized Developer ID identity name}"
    : "${APPLE_KEYCHAIN_PROFILE:?Set APPLE_KEYCHAIN_PROFILE to an existing notarytool credential profile}"
    SIGNING_NAME="${CSC_NAME#Developer ID Application: }"
    npx electron-builder --mac dmg zip --arm64 --publish never \
      "-c.mac.identity=$SIGNING_NAME" -c.mac.hardenedRuntime=true -c.mac.notarize=false
    xcrun notarytool submit "$DMG" \
      --keychain-profile "$APPLE_KEYCHAIN_PROFILE" --wait
    xcrun stapler staple "$DMG"
    xcrun stapler validate "$DMG"
    ;;
  *)
    echo 'usage: script/package_mac.sh [preview|signed|notarized]' >&2
    exit 2
    ;;
esac
codesign --verify --deep --strict dist/mac-arm64/Mineradio.app
hdiutil verify "$DMG"
shasum -a 256 "$DMG" "$ZIP"
