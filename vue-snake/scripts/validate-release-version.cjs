const packageVersion = require("../package.json").version;
const rawRefName = process.env.RELEASE_TAG_NAME || process.env.GITHUB_REF_NAME || "";
const tagVersion = rawRefName.trim().replace(/^v/, "");

if (!tagVersion) {
  console.error("RELEASE_TAG_NAME or GITHUB_REF_NAME is required to validate the release version.");
  process.exit(1);
}

if (packageVersion !== tagVersion) {
  console.error(
    `Tag v${tagVersion} does not match package.json version ${packageVersion}`,
  );
  process.exit(1);
}

console.log(`Validated release tag v${tagVersion} against package version ${packageVersion}.`);
