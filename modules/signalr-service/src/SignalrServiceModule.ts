import { NativeModule, requireNativeModule } from "expo";

declare class SignalrServiceModule extends NativeModule<{}> {
  startService(config: {
    hubUrl: string;
    accessToken?: string;
    groups?: string[];
    keepAliveMs?: number;
    serverTimeoutMs?: number;
    notificationTitle?: string;
    notificationText?: string;
  }): Promise<boolean>;

  stopService(): Promise<boolean>;

  onEvent(eventName: string, callback: Promise<any>): Promise<void>;

  offEvent(eventName: string, callback: Promise<any>): Promise<void>;

  registerHandlers(): Promise<void>;

  unregisterHandlers(): Promise<void>;

  invoke(methodName: string, args: any[]): Promise<any>;

  send(methodName: string, args: any[]): Promise<void>;

  getConnectionStatus(): Promise<string>;
}

export default requireNativeModule<SignalrServiceModule>("SignalrService");
