const REQUIRED_SECRETS = {
  linux: [],
  mac: [
    "APPLE_SIGNING_CERT_B64",
    "APPLE_SIGNING_CERT_PASSWORD",
    "APPLE_INSTALLER_CERT_B64",
    "APPLE_INSTALLER_CERT_PASSWORD",
    "APPLE_API_KEY_B64",
    "APPLE_API_KEY_ID",
    "APPLE_API_ISSUER",
  ],
  win: ["WINDOWS_SIGNING_CERT_B64", "WINDOWS_SIGNING_CERT_PASSWORD"],
};

function validateReleaseSigning(target, env = process.env) {
  if (!target) {
    throw new Error("RELEASE_SIGNING_TARGET is required.");
  }

  if (!Object.hasOwn(REQUIRED_SECRETS, target)) {
    throw new Error(`Unsupported release signing target: ${target}`);
  }

  const missing = REQUIRED_SECRETS[target].filter(secret => {
    const value = env[secret];
    return typeof value !== "string" || value.trim() === "";
  });

  if (missing.length > 0) {
    throw new Error(`Missing signing secrets for ${target}: ${missing.join(", ")}`);
  }

  return REQUIRED_SECRETS[target];
}

if (require.main === module) {
  validateReleaseSigning(process.env.RELEASE_SIGNING_TARGET);
  console.log(`Validated signing secrets for ${process.env.RELEASE_SIGNING_TARGET}.`);
}

module.exports = {
  REQUIRED_SECRETS,
  validateReleaseSigning,
};
