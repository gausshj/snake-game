const packageVersion = require("../package.json").version;
const tagVersion = (process.env.GITHUB_REF_NAME || "").replace(/^v/, "");

if (!tagVersion) {
  console.error("GITHUB_REF_NAME is required to validate the release version.");
  process.exit(1);
}

if (packageVersion !== tagVersion) {
  console.error(
    `Tag v${tagVersion} does not match package.json version ${packageVersion}`,
  );
  process.exit(1);
}

console.log(`Validated release tag v${tagVersion} against package version ${packageVersion}.`);
