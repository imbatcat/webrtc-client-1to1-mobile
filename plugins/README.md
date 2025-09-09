# Custom Expo Config Plugins

This directory contains custom Expo config plugins for the WebRTC mobile application.

## Plugin Development Workflow

### 1. Plugin Structure

```javascript
const { withAndroidManifest, withInfoPlist } = require("@expo/config-plugins");

const withYourPlugin = (config, props = {}) => {
  // Modify Android configuration
  config = withAndroidManifest(config, (config) => {
    // Modify androidManifest
    return config;
  });

  // Modify iOS configuration
  config = withInfoPlist(config, (config) => {
    // Modify Info.plist
    return config;
  });

  return config;
};

module.exports = withYourPlugin;
```

### 2. Testing Plugins

```bash
# Test plugin configuration
npx expo config --type public

# Prebuild to test native modifications
npx expo prebuild --clean

# Verify Android manifest changes
cat android/app/src/main/AndroidManifest.xml

# Verify iOS plist changes (macOS only)
cat ios/YourApp/Info.plist
```

### 3. Plugin Development Best Practices

#### Android Manifest Modifications

- Always check if permissions/features already exist before adding
- Use proper Android API level targeting
- Test on different Android versions

#### iOS Info.plist Modifications

- Validate plist structure after modifications
- Test background modes thoroughly
- Consider iOS version compatibility

### 4. Available Plugins

#### `webrtc-custom-plugin.js`

Enhances WebRTC configuration with:

- Advanced Android foreground service permissions
- iOS VoIP background modes
- Custom notification channel configuration

**Usage in app.config.js:**

```javascript
[
  "./plugins/webrtc-custom-plugin.js",
  {
    foregroundServiceType: "mediaProjection", // or "camera", "microphone"
    enableVoIPBackground: true,
    customNotificationChannel: true,
  },
];
```

### 5. Plugin Development Commands

```bash
# Install plugin development dependencies
npm install @expo/config-plugins

# Test plugin without building
npx expo config --type public | jq '.expo.plugins'

# Generate native code with plugins
npx expo prebuild --clean

# Build with custom plugins
npx eas build --profile development
```

### 6. Debugging Plugin Issues

#### Common Issues:

1. **Plugin not loading**: Check file path and export syntax
2. **Manifest malformed**: Validate XML structure after modifications
3. **Plist errors**: Use proper plist data types
4. **Permission conflicts**: Check for duplicate permissions

#### Debug Commands:

```bash
# Validate configuration
npx expo config --type public

# Check for plugin errors
npx expo prebuild --clean --verbose

# Inspect generated files
ls -la android/app/src/main/AndroidManifest.xml
ls -la ios/*/Info.plist
```

### 7. Plugin Testing Checklist

- [ ] Plugin loads without errors
- [ ] Configuration validates with `expo config`
- [ ] Prebuild completes successfully
- [ ] Android manifest contains expected changes
- [ ] iOS plist contains expected changes
- [ ] App builds and runs with plugin
- [ ] Native functionality works as expected

## References

- [Expo Config Plugins Documentation](https://docs.expo.dev/guides/config-plugins/)
- [Android Manifest Reference](https://developer.android.com/guide/topics/manifest/manifest-intro)
- [iOS Info.plist Reference](https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/)
