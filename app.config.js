export default ({ config }) => ({
  ...config,
  expo: {
    name: "webrtc-client-1to1-mobile",
    slug: "webrtc-client-1to1-mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    scheme: "webrtc-client",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      permissions: [
        "CAMERA",
        "RECORD_AUDIO",
        "FOREGROUND_SERVICE",
        "WAKE_LOCK",
        "USE_FULL_SCREEN_INTENT",
        "POST_NOTIFICATIONS",
      ],
      edgeToEdgeEnabled: true,
      package: "com.oranged_cat.webrtcclient1to1mobile",
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    extra: {
      eas: {
        projectId: "1f552dfb-8638-448a-a334-2ff3f95b99e9",
      },
    },
    owner: "oranged_cat",
    plugins: [
      "expo-router",
      [
        "@config-plugins/react-native-webrtc",
        {
          cameraPermission: "Allow $(PRODUCT_NAME) to access your camera",
          microphonePermission:
            "Allow $(PRODUCT_NAME) to access your microphone",
        },
      ],
      "expo-background-task",
      [
        "expo-build-properties",
        {
          android: {
            kotlinVersion: "2.0.21",
          },
        },
      ],
    ],
  },
});
