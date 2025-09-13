import { NativeModule, requireNativeModule } from "expo";
import { SignalrServiceModuleEvents } from "./SignalrService.types";

declare class SignalrServiceModule extends NativeModule<SignalrServiceModuleEvents> {
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

  registerHandlers(): Promise<void>;

  unregisterHandlers(): Promise<void>;

  invoke(methodName: string, args: any[]): Promise<any>;

  send(methodName: string, args: any[]): Promise<void>;

  getConnectionStatus(): Promise<string>;
}

export default requireNativeModule<SignalrServiceModule>("SignalrService");
