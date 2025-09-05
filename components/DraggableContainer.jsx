import React, { useState, useCallback } from "react";
import { Dimensions, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";

export default function DraggableContainer({
  children,
  initialPosition = { x: 0, y: 0 },
  containerWidth = 150,
  containerHeight = 200,
  onSnapToCorner,
  setDraggableContainerPosition,
  cornerOffset = { top: 0, left: 0, right: 0, bottom: 0 },
  style,
}) {
  const translateX = useSharedValue(initialPosition.x);
  const translateY = useSharedValue(initialPosition.y);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  // Get screen dimensions outside worklet
  const screenWidth = Dimensions.get("window").width;
  const screenHeight = Dimensions.get("window").height;

  const panGesture = Gesture.Pan()
    .minDistance(5) //5px minimum trigger distance
    .onStart(() => {
      scale.value = withSpring(1.05);
      opacity.value = withTiming(0.8, { duration: 200 });
    })
    .onUpdate((event) => {
      translateX.value = initialPosition.x + event.translationX;
      translateY.value = initialPosition.y + event.translationY;
    })
    .onEnd((event) => {
      const corners = [
        { x: 0 + cornerOffset.left, y: 0 + cornerOffset.top },
        {
          x: screenWidth - containerWidth - cornerOffset.right,
          y: 0 + cornerOffset.top,
        },
        {
          x: 0 + cornerOffset.left,
          y: screenHeight - containerHeight - cornerOffset.bottom,
        },
        {
          x: screenWidth - containerWidth - cornerOffset.right,
          y: screenHeight - containerHeight - cornerOffset.bottom,
        },
      ];

      const finalPosition = corners.reduce(
        (nearest, corner) => {
          const distance = Math.sqrt(
            (corner.x - translateX.value) ** 2 +
              (corner.y - translateY.value) ** 2
          );
          return distance < nearest.distance ? { corner, distance } : nearest;
        },
        { corner: corners[0], distance: Infinity }
      ).corner;

      if (onSnapToCorner) {
        runOnJS(onSnapToCorner)(finalPosition);
      }

      translateX.value = withSpring(finalPosition.x, {
        damping: 15,
        stiffness: 150,
        velocity: event.velocityX,
      });
      translateY.value = withSpring(finalPosition.y, {
        damping: 15,
        stiffness: 150,
        velocity: event.velocityY,
      });
      scale.value = withSpring(1);
      opacity.value = withTiming(1, { duration: 300 });
      runOnJS(setDraggableContainerPosition)({
        x: finalPosition.x,
        y: finalPosition.y,
      });
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
      <Animated.View style={[styles.container, style, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    zIndex: 1000,
    borderRadius: 8,
    margin: 5,
  },
});
