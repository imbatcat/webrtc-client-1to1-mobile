import React, { useState } from "react";
import axios from "axios";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const isFormValid =
    username.trim().length > 0 &&
    password.length > 0 &&
    roomId.trim().length > 0;

  async function handleSubmit() {
    if (!isFormValid || loading) return;
    setError("");
    setLoading(true);
    try {
      const url = process.env.EXPO_PUBLIC_API_URL + "/meetingroom/login";
      console.log(url);
      const response = await axios.post(url, {
        username,
        password,
        roomId,
      });

      if (response.status === 200) {
        const token = response.data.accessToken;
        console.log(token);
        await AsyncStorage.setItem("accessToken", token);
        await AsyncStorage.setItem("username", username);
        await AsyncStorage.setItem("roomId", roomId);
        router.push({
          pathname: "/navigation",
        });
      } else {
        Alert.alert("Error", "Login failed. Please try again.");
      }
      console.log(response.data);
    } catch (e) {
      console.error("Login error:", e);
      Alert.alert("Error", "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <View style={styles.formWrapper}>
        <Text style={styles.title}>Login</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Username</Text>
          <TextInput
            style={[
              styles.input,
              username.length > 0 && !isFormValid ? styles.inputError : null,
            ]}
            placeholder="Enter your username"
            value={username}
            onChangeText={setUsername}
            keyboardType="default"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            accessibilityLabel="Username"
            returnKeyType="next"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            accessibilityLabel="Password"
            returnKeyType="next"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Room ID</Text>
          <TextInput
            style={[
              styles.input,
              roomId.length > 0 && !isFormValid ? styles.inputError : null,
            ]}
            placeholder="Enter meeting room ID"
            value={roomId}
            onChangeText={setRoomId}
            keyboardType="default"
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="Room ID"
            returnKeyType="done"
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          onPress={handleSubmit}
          disabled={!isFormValid || loading}
          style={({ pressed }) => [
            styles.button,
            !isFormValid || loading ? styles.buttonDisabled : null,
            pressed ? styles.buttonPressed : null,
          ]}
          accessibilityLabel="Login"
          accessibilityState={{ disabled: !isFormValid || loading }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  formWrapper: {
    width: "100%",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  inputError: {
    borderColor: "#c62828",
  },
  errorText: {
    color: "#c62828",
    marginBottom: 8,
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    alignItems: "center",
    paddingVertical: 12,
  },
  buttonDisabled: {
    backgroundColor: "#9bb7ff",
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
