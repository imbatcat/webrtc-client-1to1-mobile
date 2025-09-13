import { registerWebModule, NativeModule } from "expo";
import { SignalrServiceModuleEvents } from "./SignalrService.types";

class SignalrServiceModule extends NativeModule<SignalrServiceModuleEvents> {
  async startService(): Promise<boolean> {
    console.warn("[SignalrService] startService is a no-op on web");
    return false;
  }
  async stopService(): Promise<boolean> {
    console.warn("[SignalrService] stopService is a no-op on web");
    return false;
  }
}

export default registerWebModule(SignalrServiceModule, "SignalrService");
