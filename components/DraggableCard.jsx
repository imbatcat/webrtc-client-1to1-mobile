import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const DraggableCard = () => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      scale.value = withSpring(1.1);
      opacity.value = withTiming(0.8, { duration: 200 });
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const { velocityX, velocityY } = event;

      // Calculate final position with bounds checking
      const finalX = Math.max(
        -screenWidth / 2 + 75, // Left bound (half card width)
        Math.min(screenWidth / 2 - 75, translateX.value) // Right bound
      );
      const finalY = Math.max(
        -screenHeight / 2 + 100, // Top bound (half card height)
        Math.min(screenHeight / 2 - 100, translateY.value) // Bottom bound
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

      // Reset scale and opacity
      scale.value = withSpring(1);
      opacity.value = withTiming(1, { duration: 300 });
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      opacity: opacity.value,
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, animatedStyle]}>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>🎯 Draggable Card</Text>
          <Text style={styles.cardSubtitle}>
            Drag me around! I'll stay within bounds and bounce back smoothly.
          </Text>
          <View style={styles.cardFooter}>
            <Text style={styles.cardFooterText}>
              ✨ Smooth 60fps animations
            </Text>
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
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
    lineHeight: 16,
  },
  cardFooter: {
    alignItems: "center",
  },
  cardFooterText: {
    fontSize: 10,
    color: "#999",
    fontStyle: "italic",
  },
});

export default DraggableCard;
