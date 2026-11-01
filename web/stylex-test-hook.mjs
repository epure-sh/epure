const webPackage = new URL("./package.json", import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@stylexjs/stylex" || specifier.includes("@stylexjs/stylex/")) {
    return {
      url: new URL("./stylex-test-mock.mjs", import.meta.url).href,
      shortCircuit: true,
    };
  }
  if (
    specifier === "react" ||
    specifier.startsWith("react/") ||
    specifier === "react-dom" ||
    specifier.startsWith("react-dom/")
  ) {
    return nextResolve(specifier, {
      ...context,
      parentURL: webPackage,
    });
  }
  return nextResolve(specifier, context);
}
