const { withAndroidManifest, withInfoPlist } = require("@expo/config-plugins");

/**
 * Custom WebRTC Plugin for Enhanced Permissions and Configuration
 *
 * This plugin extends the base WebRTC configuration with:
 * - Advanced Android foreground service permissions
 * - iOS background modes for VoIP
 * - Custom notification channels
 */

const withWebRTCCustomConfig = (config, props = {}) => {
  const {
    foregroundServiceType = "mediaProjection",
    enableVoIPBackground = true,
    customNotificationChannel = true,
  } = props;

  // Android Manifest modifications
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;

    // Add foreground service permissions
    const permissions = androidManifest.manifest.permission || [];

    // Add foreground service type if not present
    const foregroundServicePermission = permissions.find(
      (p) => p.$["android:name"] === "android.permission.FOREGROUND_SERVICE"
    );

    if (!foregroundServicePermission) {
      permissions.push({
        $: {
          "android:name": "android.permission.FOREGROUND_SERVICE",
        },
      });
    }

    // Add foreground service type permission for Android 14+
    const foregroundServiceTypePermission = permissions.find(
      (p) =>
        p.$["android:name"] ===
        `android.permission.FOREGROUND_SERVICE_${foregroundServiceType.toUpperCase()}`
    );

    if (!foregroundServiceTypePermission) {
      permissions.push({
        $: {
          "android:name": `android.permission.FOREGROUND_SERVICE_${foregroundServiceType.toUpperCase()}`,
        },
      });
    }

    androidManifest.manifest.permission = permissions;

    // Add application-level configuration
    const application = androidManifest.manifest.application[0];

    if (customNotificationChannel) {
      // Add metadata for notification channels
      const metadata = application["meta-data"] || [];
      metadata.push({
        $: {
          "android:name": "com.webrtc.notification.channel.id",
          "android:value": "webrtc_call_channel",
        },
      });
      application["meta-data"] = metadata;
    }

    return config;
  });

  // iOS Info.plist modifications
  if (enableVoIPBackground) {
    config = withInfoPlist(config, (config) => {
      const plist = config.modResults;

      // Add background modes for VoIP
      if (!plist.UIBackgroundModes) {
        plist.UIBackgroundModes = [];
      }

      const backgroundModes = ["voip", "audio", "background-processing"];
      backgroundModes.forEach((mode) => {
        if (!plist.UIBackgroundModes.includes(mode)) {
          plist.UIBackgroundModes.push(mode);
        }
      });

      return config;
    });
  }

  return config;
};

module.exports = withWebRTCCustomConfig;
