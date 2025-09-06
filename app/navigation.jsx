import React from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from "react-native";

export default function Navigation() {
  const router = useRouter();

  const handleMeetingPress = () => {
    router.push({ pathname: "/meeting" });
  };

  const handleLoremPress = () => {
    router.push({ pathname: "/lorem" });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>WebRTC Client</Text>
          <Text style={styles.subtitle}>Choose your destination</Text>
        </View>

        <View style={styles.buttonContainer}>
          <Pressable
            onPress={handleMeetingPress}
            style={({ pressed }) => [
              styles.navigationButton,
              styles.meetingButton,
              pressed && styles.buttonPressed,
            ]}
            accessibilityLabel="Go to Meeting"
            accessibilityRole="button"
          >
            <View style={styles.buttonContent}>
              <Text style={styles.buttonIcon}>📹</Text>
              <Text style={[styles.buttonText, styles.meetingButtonText]}>
                Start Meeting
              </Text>
              <Text style={[styles.buttonSubtext, styles.meetingButtonSubtext]}>
                Join a video call session
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={handleLoremPress}
            style={({ pressed }) => [
              styles.navigationButton,
              styles.loremButton,
              pressed && styles.buttonPressed,
            ]}
            accessibilityLabel="Go to Lorem Ipsum"
            accessibilityRole="button"
          >
            <View style={styles.buttonContent}>
              <Text style={styles.buttonIcon}>📄</Text>
              <Text style={[styles.buttonText, styles.loremButtonText]}>
                Lorem Ipsum
              </Text>
              <Text style={[styles.buttonSubtext, styles.loremButtonSubtext]}>
                View sample content
              </Text>
            </View>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
  },
  buttonContainer: {
    gap: 20,
  },
  navigationButton: {
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  meetingButton: {
    backgroundColor: "#007AFF",
  },
  loremButton: {
    backgroundColor: "#34c759",
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonContent: {
    alignItems: "center",
  },
  buttonIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 4,
  },
  meetingButtonText: {
    color: "#fff",
  },
  loremButtonText: {
    color: "#fff",
  },
  buttonSubtext: {
    fontSize: 14,
    opacity: 0.9,
  },
  meetingButtonSubtext: {
    color: "#fff",
  },
  loremButtonSubtext: {
    color: "#fff",
  },
});
