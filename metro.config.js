// metro.config.js

// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add WebRTC support
config.resolver.platforms = ["ios", "android", "native", "web"];

// Handle WebRTC native modules
config.resolver.assetExts.push("caf");
config.resolver.assetExts.push("pem");

// Exclude problematic packages from transformation
config.transformer.minifierConfig = {
  keep_fnames: true,
  mangle: {
    keep_fnames: true,
  },
};

// Handle event-target-shim for WebRTC
config.resolver.alias = {
  "event-target-shim": require.resolve("event-target-shim"),
};

module.exports = config;
