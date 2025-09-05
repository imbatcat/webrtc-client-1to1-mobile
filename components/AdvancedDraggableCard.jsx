import React, { useState } from "react";
import { View, Text, StyleSheet, Dimensions, Alert } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  runOnJS,
} from "react-native-reanimated";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const AdvancedDraggableCard = () => {
  const [tapCount, setTapCount] = useState(0);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(1);

  const showAlert = (message) => {
    Alert.alert("Gesture Detected!", message);
  };

  const panGesture = Gesture.Pan()
    .onStart(() => {
      scale.value = withSpring(1.1);
      opacity.value = withTiming(0.8, { duration: 200 });
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      // Add slight rotation based on movement
      rotation.value = event.translationX * 0.1;
    })
    .onEnd((event) => {
      const { velocityX, velocityY } = event;

      // Calculate final position with bounds checking
      const finalX = Math.max(
        -screenWidth / 2 + 75,
        Math.min(screenWidth / 2 - 75, translateX.value)
      );
      const finalY = Math.max(
        -screenHeight / 2 + 100,
        Math.min(screenHeight / 2 - 100, translateY.value)
      );

      // Animate to final position with spring physics
      translateX.value = withSpring(finalX, {
        damping: 15,
        stiffness: 150,
        velocity: velocityX,
      });
      translateY.value = withSpring(finalY, {
        damping: 15,
        stiffness: 150,
        velocity: velocityY,
      });

      // Reset transformations
      scale.value = withSpring(1);
      rotation.value = withSpring(0);
      opacity.value = withTiming(1, { duration: 300 });
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(setTapCount)((prev) => prev + 1);
    runOnJS(showAlert)(`Tap count: ${tapCount + 1}`);

    // Bounce animation on tap
    scale.value = withSequence(
      withTiming(1.2, { duration: 100 }),
      withSpring(1, { damping: 8, stiffness: 200 })
    );
  });

  const longPressGesture = Gesture.LongPress()
    .minDuration(800)
    .onStart(() => {
      runOnJS(showAlert)("Long press detected!");

      // Shake animation
      rotation.value = withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );

      // Scale animation
      scale.value = withSequence(
        withTiming(1.3, { duration: 200 }),
        withSpring(1, { damping: 10, stiffness: 150 })
      );
    });

  const composedGesture = Gesture.Simultaneous(
    panGesture,
    tapGesture,
    longPressGesture
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
        { rotate: `${rotation.value}deg` },
      ],
      opacity: opacity.value,
    };
  });

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.card, animatedStyle]}>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>🚀 Advanced Card</Text>
          <Text style={styles.cardSubtitle}>
            • Drag to move{"\n"}• Tap to bounce{"\n"}• Long press to shake
          </Text>
          <View style={styles.cardFooter}>
            <Text style={styles.cardFooterText}>Taps: {tapCount}</Text>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 150,
    height: 200,
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  cardContent: {
    flex: 1,
    padding: 16,
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    lineHeight: 18,
  },
  cardFooter: {
    alignItems: "center",
  },
  cardFooterText: {
    fontSize: 10,
    color: "#999",
    fontWeight: "bold",
  },
});

export default AdvancedDraggableCard;
