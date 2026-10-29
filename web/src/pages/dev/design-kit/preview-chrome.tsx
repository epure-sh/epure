import * as React from "react";

/** When false, PreviewBlock renders children only (docs Example already frames). */
const PreviewChromeContext = React.createContext(true);

export function PreviewChromeProvider({
  chrome,
  children,
}: {
  chrome: boolean;
  children: React.ReactNode;
}) {
  return (
    <PreviewChromeContext.Provider value={chrome}>{children}</PreviewChromeContext.Provider>
  );
}

export function usePreviewChrome(): boolean {
  return React.useContext(PreviewChromeContext);
}
