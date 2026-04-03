const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  REQUIRED_SECRETS,
  validateReleaseSigning,
} = require("../scripts/validate-release-signing.cjs");
const { prepareSigningAssets } = require("../scripts/prepare-signing-assets.cjs");

test("validateReleaseSigning accepts linux without secrets", () => {
  assert.deepEqual(validateReleaseSigning("linux", {}), REQUIRED_SECRETS.linux);
});

test("validateReleaseSigning rejects missing mac secrets", () => {
  assert.throws(
    () => validateReleaseSigning("mac", {}),
    /Missing signing secrets for mac: APPLE_SIGNING_CERT_B64/,
  );
});

test("validateReleaseSigning rejects missing windows secrets", () => {
  assert.throws(
    () => validateReleaseSigning("win", { WINDOWS_SIGNING_CERT_B64: "abc" }),
    /WINDOWS_SIGNING_CERT_PASSWORD/,
  );
});

test("prepareSigningAssets writes mac signing files and GitHub env", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snake-signing-mac-"));
  const envFile = path.join(tempDir, "github.env");
  const env = {
    APPLE_API_ISSUER: "issuer-id",
    APPLE_API_KEY_B64: Buffer.from("api-key").toString("base64"),
    APPLE_API_KEY_ID: "ABC1234567",
    APPLE_INSTALLER_CERT_B64: Buffer.from("installer-cert").toString("base64"),
    APPLE_INSTALLER_CERT_PASSWORD: "installer-secret",
    APPLE_SIGNING_CERT_B64: Buffer.from("signing-cert").toString("base64"),
    APPLE_SIGNING_CERT_PASSWORD: "signing-secret",
    GITHUB_ENV: envFile,
    RUNNER_TEMP: tempDir,
  };

  const result = prepareSigningAssets("mac", env);
  const githubEnv = fs.readFileSync(envFile, "utf8");

  assert.match(githubEnv, /CSC_LINK=.*developer-id-application\.p12/);
  assert.match(githubEnv, /CSC_INSTALLER_LINK=.*developer-id-installer\.p12/);
  assert.match(githubEnv, /APPLE_API_KEY=.*AuthKey\.p8/);
  assert.equal(fs.readFileSync(result.signingCertPath, "utf8"), "signing-cert");
  assert.equal(fs.readFileSync(result.installerCertPath, "utf8"), "installer-cert");
  assert.equal(fs.readFileSync(result.apiKeyPath, "utf8"), "api-key");
});

test("prepareSigningAssets writes windows signing files and GitHub env", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snake-signing-win-"));
  const envFile = path.join(tempDir, "github.env");
  const env = {
    GITHUB_ENV: envFile,
    RUNNER_TEMP: tempDir,
    WINDOWS_SIGNING_CERT_B64: Buffer.from("windows-cert").toString("base64"),
    WINDOWS_SIGNING_CERT_PASSWORD: "windows-secret",
  };

  const result = prepareSigningAssets("win", env);
  const githubEnv = fs.readFileSync(envFile, "utf8");

  assert.match(githubEnv, /WIN_CSC_LINK=.*windows-signing\.pfx/);
  assert.match(githubEnv, /WIN_CSC_KEY_PASSWORD=windows-secret/);
  assert.equal(fs.readFileSync(result.certPath, "utf8"), "windows-cert");
});
