import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import DraggableContainer from "../components/DraggableContainer";

export default function TestDraggable() {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  return (
    <GestureHandlerRootView style={styles.container}>
      <Text style={styles.title}>Perfect Wrapping Test</Text>

      {/* Small content - should wrap tightly */}
      <DraggableContainer
        initialPosition={{ x: 50, y: 100 }}
        onSnapToCorner={(corner) => console.log("Snapped to:", corner)}
        setDraggableContainerPosition={setPosition}
        style={styles.smallContainer}
      >
        <Text style={styles.smallText}>Small</Text>
      </DraggableContainer>

      {/* Medium content */}
      <DraggableContainer
        initialPosition={{ x: 200, y: 100 }}
        onSnapToCorner={(corner) => console.log("Snapped to:", corner)}
        setDraggableContainerPosition={setPosition}
        style={styles.mediumContainer}
      >
        <Text style={styles.mediumText}>Medium Content</Text>
        <Text style={styles.mediumSubtext}>With multiple lines</Text>
      </DraggableContainer>

      {/* Large content */}
      <DraggableContainer
        initialPosition={{ x: 50, y: 300 }}
        onSnapToCorner={(corner) => console.log("Snapped to:", corner)}
        setDraggableContainerPosition={setPosition}
        style={styles.largeContainer}
      >
        <Text style={styles.largeText}>Large Content</Text>
        <Text style={styles.largeSubtext}>
          This is a much longer text that should wrap perfectly
        </Text>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Button</Text>
        </TouchableOpacity>
      </DraggableContainer>

      <Text style={styles.positionText}>
        Position: {position.x.toFixed(0)}, {position.y.toFixed(0)}
      </Text>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f2f5",
    paddingTop: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: "#333",
  },
  smallContainer: {
    backgroundColor: "rgba(255, 0, 0, 0.2)",
    borderRadius: 8,
    padding: 8,
  },
  mediumContainer: {
    backgroundColor: "rgba(0, 255, 0, 0.2)",
    borderRadius: 8,
    padding: 12,
  },
  largeContainer: {
    backgroundColor: "rgba(0, 0, 255, 0.2)",
    borderRadius: 8,
    padding: 16,
  },
  smallText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "bold",
  },
  mediumText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "bold",
  },
  mediumSubtext: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  largeText: {
    fontSize: 18,
    color: "#333",
    fontWeight: "bold",
  },
  largeSubtext: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    lineHeight: 20,
  },
  button: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 12,
    alignSelf: "flex-start",
  },
  buttonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  positionText: {
    position: "absolute",
    bottom: 50,
    left: 20,
    fontSize: 12,
    color: "#666",
  },
});

