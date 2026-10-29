export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@stylexjs/stylex" || specifier.includes("@stylexjs/stylex/")) {
    return {
      url: new URL("./stylex-test-mock.mjs", import.meta.url).href,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
