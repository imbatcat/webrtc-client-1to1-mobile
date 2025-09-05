import { Dimensions } from "react-native";

export const getNearestCorner = (x, y, containerWidth, containerHeight) => {
  const screenWidth = Dimensions.get("window").width;
  const screenHeight = Dimensions.get("window").height;
  const corners = [
    { x: 0, y: 0 },
    { x: screenWidth - containerWidth, y: 0 },
    { x: 0, y: screenHeight - containerHeight },
    { x: screenWidth - containerWidth, y: screenHeight - containerHeight },
  ];

  return corners.reduce(
    (nearest, corner) => {
      const distance = Math.sqrt((corner.x - x) ** 2 + (corner.y - y) ** 2);
      return distance < nearest.distance ? { corner, distance } : nearest;
    },
    { corner: corners[0], distance: Infinity }
  ).corner;
};
