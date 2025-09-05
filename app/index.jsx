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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const isFormValid = username.trim().length > 0 && password.length > 0;

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
      });

      if (response.status === 200) {
        const token = response.data.accessToken;
        console.log(token);
        await AsyncStorage.setItem("accessToken", token);
        router.push({
          pathname: "/meeting",
          params: { username },
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

        <TextInput
          style={[
            styles.input,
            username.length > 0 && !isFormValid ? styles.inputError : null,
          ]}
          placeholder="Username"
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

        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password"
          textContentType="password"
          accessibilityLabel="Password"
          returnKeyType="done"
        />

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
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 16,
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
