import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";

/**
 * MeetingAlertModal - Displays alerts during meetings (e.g., time warnings)
 *
 * @param {boolean} visible - Whether the modal is visible
 * @param {string} title - Alert title
 * @param {string} message - Alert message
 * @param {function} onDismiss - Callback when user dismisses the alert
 * @param {string} type - Alert type: 'warning' | 'info' | 'error' (default: 'warning')
 */
export default function MeetingAlertModal({
  visible,
  title = "Alert",
  message = "",
  onDismiss,
  type = "warning",
}) {
  const getIconAndColor = () => {
    switch (type) {
      case "warning":
        return { icon: "⚠️", color: "#FF9500" };
      case "error":
        return { icon: "❌", color: "#FF3B30" };
      case "info":
        return { icon: "ℹ️", color: "#007AFF" };
      default:
        return { icon: "⚠️", color: "#FF9500" };
    }
  };

  const { icon, color } = getIconAndColor();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Icon */}
          <View
            style={[styles.iconContainer, { backgroundColor: color + "20" }]}
          >
            <Text style={styles.icon}>{icon}</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Dismiss Button */}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: color }]}
            onPress={onDismiss}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    color: "#3C3C43",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  button: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
