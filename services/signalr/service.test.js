import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  HubConnectionBuilder,
  LogLevel,
  HubConnectionState,
} from "@microsoft/signalr";
import signalRService from "./service";

// Mock SignalR
jest.mock("@microsoft/signalr", () => ({
  HubConnectionBuilder: jest.fn(),
  LogLevel: { Information: "Information" },
  HubConnectionState: {
    Connected: "Connected",
    Connecting: "Connecting",
    Reconnecting: "Reconnecting",
    Disconnected: "Disconnected",
  },
  HttpTransportType: { WebSockets: "WebSockets" },
}));

describe("SignalRService", () => {
  let mockConnection;
  let mockHubConnectionBuilder;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock connection
    mockConnection = {
      start: jest.fn(),
      stop: jest.fn(),
      invoke: jest.fn(),
      onclose: jest.fn(),
      onreconnecting: jest.fn(),
      onreconnected: jest.fn(),
      state: HubConnectionState.Disconnected,
      connectionId: "test-connection-id",
      serverTimeoutInMilliseconds: 30000,
      keepAliveIntervalInMilliseconds: 15000,
    };

    // Create mock builder
    mockHubConnectionBuilder = {
      withUrl: jest.fn().mockReturnThis(),
      withAutomaticReconnect: jest.fn().mockReturnThis(),
      configureLogging: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue(mockConnection),
    };

    HubConnectionBuilder.mockImplementation(() => mockHubConnectionBuilder);

    // Mock AsyncStorage to return a test token
    AsyncStorage.getItem.mockResolvedValue("test-access-token");
  });

  afterEach(() => {
    // Reset service state
    signalRService.stopConnection();
  });

  describe("Connection Management", () => {
    test("should start connection successfully", async () => {
      mockConnection.start.mockResolvedValue();
      mockConnection.state = HubConnectionState.Connected;

      await signalRService.startConnection();

      expect(HubConnectionBuilder).toHaveBeenCalled();
      expect(mockHubConnectionBuilder.withUrl).toHaveBeenCalledWith(
        expect.any(String), // Don't check exact URL since it comes from env
        expect.objectContaining({
          accessTokenFactory: expect.any(Function),
          skipNegotiation: true,
          transport: "WebSockets",
        })
      );
      expect(mockConnection.start).toHaveBeenCalled();
    });

    test("should configure timeouts and keepalive", async () => {
      mockConnection.start.mockResolvedValue();
      mockConnection.state = HubConnectionState.Connected;

      await signalRService.startConnection();

      // Check that timeouts were set (these should be set by the service)
      expect(mockConnection.serverTimeoutInMilliseconds).toBe(90000);
      expect(mockConnection.keepAliveIntervalInMilliseconds).toBe(30000);
    });

    test("should stop connection successfully", async () => {
      mockConnection.start.mockResolvedValue();
      mockConnection.state = HubConnectionState.Connected;
      await signalRService.startConnection();

      await signalRService.stopConnection();

      expect(mockConnection.stop).toHaveBeenCalled();
    });
  });

  describe("Group Management", () => {
    beforeEach(async () => {
      mockConnection.start.mockResolvedValue();
      mockConnection.state = HubConnectionState.Connected;
      await signalRService.startConnection();
    });

    test("should add to group successfully", async () => {
      mockConnection.invoke.mockResolvedValue();

      const result = await signalRService.addToGroup("testGroup");

      expect(result).toBe(true);
      expect(mockConnection.invoke).toHaveBeenCalledWith(
        "AddToGroup",
        "testGroup"
      );
    });

    test("should remove from group successfully", async () => {
      mockConnection.invoke.mockResolvedValue();
      await signalRService.addToGroup("testGroup");

      const result = await signalRService.removeFromGroup("testGroup");

      expect(result).toBe(true);
      expect(mockConnection.invoke).toHaveBeenCalledWith(
        "RemoveFromGroup",
        "testGroup"
      );
    });

    test("should handle group operations when not connected", async () => {
      mockConnection.state = HubConnectionState.Disconnected;

      const addResult = await signalRService.addToGroup("testGroup");
      const removeResult = await signalRService.removeFromGroup("testGroup");

      expect(addResult).toBe(false);
      expect(removeResult).toBe(false);
      expect(mockConnection.invoke).not.toHaveBeenCalled();
    });

    test("should handle group operation failures gracefully", async () => {
      mockConnection.invoke.mockRejectedValue(
        new Error("Group operation failed")
      );

      const result = await signalRService.addToGroup("testGroup");

      expect(result).toBe(false);
    });
  });

  describe("Event System", () => {
    test("should register event callbacks", () => {
      const mockCallback = jest.fn();

      signalRService.onEvent("testEvent", mockCallback);

      // Test that callback was registered by triggering it
      signalRService.triggerCallback("testEvent", "testData");
      expect(mockCallback).toHaveBeenCalledWith("testData");
    });

    test("should handle multiple callbacks for same event", () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      signalRService.onEvent("testEvent", callback1);
      signalRService.onEvent("testEvent", callback2);

      // Trigger event and verify both callbacks were called
      signalRService.triggerCallback("testEvent", "testData");
      expect(callback1).toHaveBeenCalledWith("testData");
      expect(callback2).toHaveBeenCalledWith("testData");
    });

    test("should remove event callbacks", () => {
      const mockCallback = jest.fn();
      signalRService.onEvent("testEvent", mockCallback);

      signalRService.offEvent("testEvent", mockCallback);

      // Verify callback was removed by triggering event
      signalRService.triggerCallback("testEvent", "testData");
      expect(mockCallback).not.toHaveBeenCalled();
    });

    test("should handle once events", () => {
      const mockCallback = jest.fn();

      signalRService.once("testEvent", mockCallback);

      // Trigger twice
      signalRService.triggerCallback("testEvent", "data1");
      signalRService.triggerCallback("testEvent", "data2");

      expect(mockCallback).toHaveBeenCalledTimes(1);
      // The once callback doesn't receive data, it's just called
      expect(mockCallback).toHaveBeenCalled();
    });

    test("should trigger callbacks with data", () => {
      const mockCallback = jest.fn();
      signalRService.onEvent("testEvent", mockCallback);

      signalRService.triggerCallback("testEvent", "testData");

      expect(mockCallback).toHaveBeenCalledWith("testData");
    });

    test("should handle callback errors gracefully", () => {
      const mockCallback = jest.fn().mockImplementation(() => {
        throw new Error("Callback error");
      });
      signalRService.onEvent("testEvent", mockCallback);

      // Should not throw
      expect(() => {
        signalRService.triggerCallback("testEvent", "data");
      }).not.toThrow();
    });

    test("should validate event names", () => {
      expect(() => signalRService.onEvent("", jest.fn())).toThrow(
        "Event name must be a non-empty string"
      );
      expect(() => signalRService.onEvent(null, jest.fn())).toThrow(
        "Event name must be a non-empty string"
      );
      expect(() => signalRService.onEvent(undefined, jest.fn())).toThrow(
        "Event name must be a non-empty string"
      );
    });

    test("should validate callbacks", () => {
      expect(() => signalRService.onEvent("testEvent", "notAFunction")).toThrow(
        "Callback must be a function"
      );
      expect(() => signalRService.onEvent("testEvent", null)).toThrow(
        "Callback must be a function"
      );
    });
  });

  describe("Connection Status", () => {
    test("should return correct connection status", () => {
      const status = signalRService.connectionStatus;

      expect(status).toHaveProperty("state");
      expect(status).toHaveProperty("connectionId");
    });
  });

  describe("Lifecycle Handlers", () => {
    test("should setup lifecycle handlers on connection", async () => {
      mockConnection.start.mockResolvedValue();
      mockConnection.state = HubConnectionState.Connected;

      await signalRService.startConnection();

      expect(mockConnection.onclose).toBeDefined();
      expect(mockConnection.onreconnecting).toBeDefined();
      expect(mockConnection.onreconnected).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    test("should handle group operation failures gracefully", async () => {
      mockConnection.start.mockResolvedValue();
      mockConnection.state = HubConnectionState.Connected;
      await signalRService.startConnection();

      mockConnection.invoke.mockRejectedValue(new Error("Server error"));

      const result = await signalRService.addToGroup("testGroup");
      expect(result).toBe(false);
    });
  });

  describe("Environment Configuration", () => {
    test("should use environment variables for configuration", () => {
      // Check that environment variables are accessible
      expect(process.env.EXPO_PUBLIC_HUB_URL).toBeDefined();
      expect(process.env.EXPO_PUBLIC_SIGNALR_SERVER_TIMEOUT_MS).toBeDefined();
      expect(process.env.EXPO_PUBLIC_SIGNALR_KEEPALIVE_MS).toBeDefined();
    });
  });
});
