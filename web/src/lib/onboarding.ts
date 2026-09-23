/** Best landing path after login or registration: workspace projects home. */
export async function resolvePostAuthPath(): Promise<string> {
  return "/";
}
