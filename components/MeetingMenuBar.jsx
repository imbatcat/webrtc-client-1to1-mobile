import { View, Pressable, StyleSheet } from "react-native";
import { Feather, Foundation, MaterialIcons } from "@expo/vector-icons";
export default function MeetingMenuBar({
  isAudioMuted,
  isVideoMuted,
  isMinimized,
  onToggleAudio,
  onToggleVideo,
  onToggleEndCall,
  onToggleFlipCamera,
  onToggleMinimize,
}) {
  const onScreen = StyleSheet.create({
    container: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 10,
      paddingLeft: 50,
      paddingRight: 50,
      backgroundColor: "#000000",
      borderRadius: 10,
      margin: 10,
      marginBottom: 50,
      width: "90%",
      alignSelf: "center",
    },
  });

  return (
    <View style={onScreen.container}>
      <Pressable onPress={onToggleAudio}>
        <Feather
          name={isAudioMuted ? "mic-off" : "mic"}
          size={24}
          color="white"
        />
      </Pressable>
      <Pressable onPress={onToggleVideo}>
        <Feather
          name={isVideoMuted ? "video-off" : "video"}
          size={24}
          color="white"
        />
      </Pressable>
      <Pressable onPress={onToggleEndCall}>
        <MaterialIcons name="call-end" size={24} color="red" />
      </Pressable>
      <Pressable onPress={onToggleFlipCamera}>
        <Foundation name="loop" size={24} color="blue" />
      </Pressable>
      <Pressable onPress={onToggleMinimize}>
        <Feather
          name={isMinimized ? "maximize-2" : "minimize-2"}
          size={24}
          color="white"
        />
      </Pressable>
    </View>
  );
}
