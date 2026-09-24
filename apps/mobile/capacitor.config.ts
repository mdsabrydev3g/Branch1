import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.branch1.dashboard",
  appName: "Branch1",
  webDir: "www",
  server: {
    url: "https://branch1-mu.vercel.app/",
    cleartext: false,
    allowNavigation: ["branch1-mu.vercel.app"]
  }
};

export default config;
