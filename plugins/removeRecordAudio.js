// Config plugin: strips android.permission.RECORD_AUDIO from the merged manifest.
// expo-av adds it automatically even for playback-only apps; this plugin removes it
// at prebuild time so the final .aab never declares it.
const { withAndroidManifest } = require("expo/config-plugins");

module.exports = function withRemoveRecordAudio(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;
    const permissions =
      manifest.manifest["uses-permission"] ?? [];

    manifest.manifest["uses-permission"] = permissions.filter(
      (p) =>
        p.$?.["android:name"] !== "android.permission.RECORD_AUDIO"
    );

    return mod;
  });
};
