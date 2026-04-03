const fs = require("node:fs");
const path = require("node:path");

function requireEnv(name, env = process.env) {
  const value = env[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function appendGithubEnv(githubEnvPath, key, value) {
  fs.appendFileSync(githubEnvPath, `${key}=${value}\n`);
}

function writeBase64File(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.from(value, "base64"));
}

function prepareMacSigning(env = process.env) {
  const runnerTemp = requireEnv("RUNNER_TEMP", env);
  const githubEnv = requireEnv("GITHUB_ENV", env);
  const signingDir = path.join(runnerTemp, "apple-signing");
  const signingCertPath = path.join(signingDir, "developer-id-application.p12");
  const installerCertPath = path.join(signingDir, "developer-id-installer.p12");
  const apiKeyPath = path.join(signingDir, "AuthKey.p8");

  writeBase64File(signingCertPath, requireEnv("APPLE_SIGNING_CERT_B64", env));
  writeBase64File(installerCertPath, requireEnv("APPLE_INSTALLER_CERT_B64", env));
  writeBase64File(apiKeyPath, requireEnv("APPLE_API_KEY_B64", env));

  appendGithubEnv(githubEnv, "CSC_LINK", signingCertPath);
  appendGithubEnv(githubEnv, "CSC_KEY_PASSWORD", requireEnv("APPLE_SIGNING_CERT_PASSWORD", env));
  appendGithubEnv(githubEnv, "CSC_INSTALLER_LINK", installerCertPath);
  appendGithubEnv(
    githubEnv,
    "CSC_INSTALLER_KEY_PASSWORD",
    requireEnv("APPLE_INSTALLER_CERT_PASSWORD", env),
  );
  appendGithubEnv(githubEnv, "APPLE_API_KEY", apiKeyPath);
  appendGithubEnv(githubEnv, "APPLE_API_KEY_ID", requireEnv("APPLE_API_KEY_ID", env));
  appendGithubEnv(githubEnv, "APPLE_API_ISSUER", requireEnv("APPLE_API_ISSUER", env));

  return { apiKeyPath, installerCertPath, signingCertPath };
}

function prepareWindowsSigning(env = process.env) {
  const runnerTemp = requireEnv("RUNNER_TEMP", env);
  const githubEnv = requireEnv("GITHUB_ENV", env);
  const signingDir = path.join(runnerTemp, "windows-signing");
  const certPath = path.join(signingDir, "windows-signing.pfx");

  writeBase64File(certPath, requireEnv("WINDOWS_SIGNING_CERT_B64", env));

  appendGithubEnv(githubEnv, "WIN_CSC_LINK", certPath);
  appendGithubEnv(
    githubEnv,
    "WIN_CSC_KEY_PASSWORD",
    requireEnv("WINDOWS_SIGNING_CERT_PASSWORD", env),
  );

  return { certPath };
}

function prepareSigningAssets(target, env = process.env) {
  switch (target) {
    case "linux":
      return {};
    case "mac":
      return prepareMacSigning(env);
    case "win":
      return prepareWindowsSigning(env);
    default:
      throw new Error(`Unsupported release signing target: ${target}`);
  }
}

if (require.main === module) {
  prepareSigningAssets(process.env.RELEASE_SIGNING_TARGET);
  console.log(`Prepared signing assets for ${process.env.RELEASE_SIGNING_TARGET}.`);
}

module.exports = {
  appendGithubEnv,
  prepareMacSigning,
  prepareSigningAssets,
  prepareWindowsSigning,
  requireEnv,
  writeBase64File,
};
