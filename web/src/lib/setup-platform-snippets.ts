export interface SetupSnippetFile {
  filename: string;
  code: string;
}

export interface SetupPlatformSnippet {
  id: string;
  label: string;
  files: SetupSnippetFile[];
}

export function setupPlatformSnippets(dsn: string): SetupPlatformSnippet[] {
  return [
    {
      id: "javascript",
      label: "JavaScript",
      files: [
        {
          filename: "package.json",
          code: `{
  "dependencies": {
    "@sentry/browser": "^7.120.0"
  }
}`,
        },
        {
          filename: "instrument.js",
          code: `import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "${dsn}",
});`,
        },
      ],
    },
    {
      id: "node",
      label: "Node",
      files: [
        {
          filename: "package.json",
          code: `{
  "dependencies": {
    "@sentry/node": "^7.120.0"
  }
}`,
        },
        {
          filename: "instrument.js",
          code: `import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "${dsn}",
});`,
        },
      ],
    },
    {
      id: "python",
      label: "Python",
      files: [
        {
          filename: "requirements.txt",
          code: "sentry-sdk",
        },
        {
          filename: "app.py",
          code: `import sentry_sdk

sentry_sdk.init(
    dsn="${dsn}",
)`,
        },
      ],
    },
  ];
}
