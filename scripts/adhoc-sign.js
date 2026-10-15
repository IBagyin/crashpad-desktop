// There's no paid signing certificate, so electron-builder skips signing.
// macOS still refuses to run an unsigned Apple Silicon app downloaded from
// the internet ("is damaged"), whereas an ad-hoc signed one can be allowed
// once via System Settings → Privacy & Security → Open Anyway.
const { execFileSync } = require("child_process");
const path = require("path");

exports.default = async (context) => {
  if (context.electronPlatformName !== "darwin") return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  // Extended attributes picked up from the source files make codesign bail.
  execFileSync("xattr", ["-cr", appPath], { stdio: "inherit" });
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], { stdio: "inherit" });
};
