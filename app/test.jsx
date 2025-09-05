import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, ScrollView } from "react-native";
import DraggableCard from "../components/DraggableCard";
import AdvancedDraggableCard from "../components/AdvancedDraggableCard";

export default function Test() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>WebRTC Mobile 1-to-1</Text>
        <Text style={styles.subtitle}>Interactive Gesture Demo</Text>

        <View style={styles.cardsContainer}>
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>Basic Draggable</Text>
            <DraggableCard />
          </View>

          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>Advanced Gestures</Text>
            <AdvancedDraggableCard />
          </View>
        </View>

        <StatusBar style="auto" />
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f2f5",
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 40,
    textAlign: "center",
  },
  cardsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 20,
  },
  cardSection: {
    alignItems: "center",
    marginHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
    marginBottom: 20,
    textAlign: "center",
  },
});
