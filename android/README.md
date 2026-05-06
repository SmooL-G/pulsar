# Pulsar Android (TWA via Bubblewrap)

Trusted Web Activity wrapper around the production PWA at https://pulsar-chat.fun. Built with [@bubblewrap/cli](https://github.com/GoogleChromeLabs/bubblewrap).

## How releases work

Push a tag matching `android-v*` (e.g. `android-v0.1.0`). GitHub Actions workflow [`build-android.yml`](../.github/workflows/build-android.yml) generates the Bubblewrap project from `twa-manifest.json`, signs the APK with the keystore stored in repo secrets, and uploads the signed APK as a GitHub release asset.

The web app's [DownloadPage](../apps/web/src/pages/DownloadPage.tsx) auto-discovers the latest `android-*` release and shows the APK to Android visitors.

## One-time setup — keystore secrets

The signing key must match the SHA256 fingerprint already published in [`assetlinks.json`](../apps/web/public/.well-known/assetlinks.json). If you have the original keystore, base64-encode it and add as repo secrets:

```bash
# Base64-encode the keystore on a single line (Linux/macOS)
base64 -w0 android.keystore > android.keystore.b64

# On Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("android.keystore")) > android.keystore.b64
```

Then in `https://github.com/SmooL-G/pulsar/settings/secrets/actions`, add:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | contents of `android.keystore.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | password for the keystore file |
| `ANDROID_KEY_ALIAS` | key alias inside the keystore (e.g. `pulsar`) |
| `ANDROID_KEY_PASSWORD` | password for the alias key |

## If you don't have the original keystore

Generate a new one and update `assetlinks.json` with the new SHA256:

```bash
keytool -genkey -v -keystore android.keystore \
  -alias pulsar -keyalg RSA -keysize 2048 -validity 10000

keytool -list -v -keystore android.keystore -alias pulsar | grep SHA256:
```

Replace the fingerprint in [`apps/web/public/.well-known/assetlinks.json`](../apps/web/public/.well-known/assetlinks.json) with the new value, then deploy the web container and add the keystore as secrets.

## Bumping the version

Edit `appVersionName` and `appVersionCode` in [`twa-manifest.json`](./twa-manifest.json), commit, then push a matching tag:

```bash
git tag android-v0.1.1 && git push --tags
```

`appVersionCode` must increase monotonically — Play Store rejects duplicates. `appVersionName` is the user-visible string.

## Local build (optional)

```bash
cd android
npm install -g @bubblewrap/cli
bubblewrap init --manifest=https://pulsar-chat.fun/manifest.webmanifest --directory .
bubblewrap build
```

Bubblewrap will install JDK + Android SDK on first run if missing.
