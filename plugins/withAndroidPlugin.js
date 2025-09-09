const { withAndroidManifest } = require("@expo/config-plugins");

const withAndroidPlugin = (config) => {
  const message = "Hello world";

  return withAndroidManifest(config, (config) => {
    const mainApp = config?.modResults?.manifest?.application?.[0];
    if (mainApp) {
      if (!mainApp["meta-data"]) {
        mainApp["meta-data"] = [];
      }
    }

    mainApp["meta-data"].push({
      $: {
        "android:name": "HelloWorldMsg",
        "android:value": message,
      },
    });
    return config;
  });
};

module.exports = withAndroidPlugin;
