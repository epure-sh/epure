/** Cloud vs self-hosted — set `VITE_EPURE_CLOUD=1` on Epure Cloud builds. */
export function isCloudDeployment(): boolean {
  return import.meta.env.VITE_EPURE_CLOUD === "1";
}

/** Cloud OAuth buttons — hidden on OSS builds even if env vars leak at runtime. */
export function isCloudSocialSignInVisible(enabled: boolean | undefined): boolean {
  return isCloudDeployment() && Boolean(enabled);
}

/** @deprecated use {@link isCloudSocialSignInVisible} */
export function isGoogleSignInVisible(googleEnabled: boolean | undefined): boolean {
  return isCloudSocialSignInVisible(googleEnabled);
}

/** True when running the mock-API playground (`npm run dev:playground`). */
export function isPlaygroundMode(): boolean {
  return typeof window !== "undefined" && "__EPURE_PLAYGROUND__" in window;
}

export function deploymentLabel(): string {
  return isCloudDeployment() ? "Cloud" : "Self-hosted";
}
