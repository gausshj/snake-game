# Snake Game

This repository contains two codebases:

- `vue-snake/`: the main Vue + Electron Snake app with AI modes, Python training scripts, and Electron packaging.
- `cpp/`: older standalone C++ experiments and terminal versions, moved out of the repository root.

## Main App

```bash
cd vue-snake
npm install
npm run dev
```

## Release Flow

1. Make changes on a feature branch and open a PR.
2. GitHub Actions will run CI and package preview checks for the PR automatically.
3. Update `vue-snake/package.json` when you want to cut a release.
4. Merge the PR to `main`.
5. Push a matching tag like `v1.0.0`.
6. GitHub Actions will build `.dmg`, `.pkg`, `.exe`, `.AppImage`, and `.deb`, then publish a GitHub Release.

## Signed Releases

Tag releases now enforce platform signing for macOS and Windows:

- macOS releases require a `Developer ID Application` certificate, a `Developer ID Installer` certificate, and an App Store Connect API key for notarization.
- Windows releases require a code-signing `.pfx` certificate.
- Linux artifacts are still built unsigned because there is no single Gatekeeper or SmartScreen equivalent for the current `.AppImage` and `.deb` flow.

Add these GitHub Actions secrets before cutting a release:

- `APPLE_SIGNING_CERT_B64`: base64-encoded `Developer ID Application` `.p12`
- `APPLE_SIGNING_CERT_PASSWORD`
- `APPLE_INSTALLER_CERT_B64`: base64-encoded `Developer ID Installer` `.p12`
- `APPLE_INSTALLER_CERT_PASSWORD`
- `APPLE_API_KEY_B64`: base64-encoded App Store Connect API key `.p8`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`
- `WINDOWS_SIGNING_CERT_B64`: base64-encoded Windows signing `.pfx`
- `WINDOWS_SIGNING_CERT_PASSWORD`

Once these are configured, release tags will fail fast instead of publishing unsigned macOS or Windows artifacts.

## Local Checks

```bash
uv tool install pre-commit
pre-commit install
pre-commit run --all-files
```

If you do not want to install it globally, use `uvx pre-commit run --all-files`.

## Coverage

Use `cd vue-snake && npm run test:coverage` to generate a local `lcov.info` report for Codecov.

Manual setup still required:
1. Import the repository in Codecov.
2. Add `CODECOV_TOKEN` to GitHub Actions secrets for this repository.
3. After the first successful upload, go to GitHub branch protection for `main` and mark `codecov/project` and `codecov/patch` as required status checks.
4. Merge the workflow changes to `main` so Codecov can keep posting PR status and comments.

## C++ Samples

```bash
cd cpp
make
make test
```
