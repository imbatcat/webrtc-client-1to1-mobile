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
}

export default requireNativeModule<SignalrServiceModule>("SignalrService");
