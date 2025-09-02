// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Mock environment variables
process.env.EXPO_PUBLIC_HUB_URL = "https://test-hub.example.com";
process.env.EXPO_PUBLIC_SIGNALR_SERVER_TIMEOUT_MS = "90000";
process.env.EXPO_PUBLIC_SIGNALR_KEEPALIVE_MS = "30000";

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test timeout
jest.setTimeout(10000);
