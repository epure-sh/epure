export interface SetupSnippetFile {
  filename: string;
  code: string;
}

export type SetupPlatformId =
  | "javascript"
  | "typescript"
  | "node"
  | "react"
  | "nextjs"
  | "python"
  | "go"
  | "php"
  | "ruby";

/** Filename stem under `/frameworks/*.svg` (Simple Icons, same set as landing). */
export type SetupPlatformLogoId =
  | "javascript"
  | "typescript"
  | "nodejs"
  | "react"
  | "nextjs"
  | "python"
  | "go"
  | "php"
  | "ruby";

export interface SetupPlatformSnippet {
  id: SetupPlatformId;
  label: string;
  /** Brand logo under `public/frameworks/{logo}.svg`. */
  logo: SetupPlatformLogoId;
  files: SetupSnippetFile[];
}

export function setupPlatformSnippets(dsn: string): SetupPlatformSnippet[] {
  return [
    {
      id: "javascript",
      label: "JavaScript",
      logo: "javascript",
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
      id: "typescript",
      label: "TypeScript",
      logo: "typescript",
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
          filename: "instrument.ts",
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
      logo: "nodejs",
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
      id: "react",
      label: "React",
      logo: "react",
      files: [
        {
          filename: "package.json",
          code: `{
  "dependencies": {
    "@sentry/react": "^7.120.0"
  }
}`,
        },
        {
          filename: "main.tsx",
          code: `import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "${dsn}",
});`,
        },
      ],
    },
    {
      id: "nextjs",
      label: "Next.js",
      logo: "nextjs",
      files: [
        {
          filename: "package.json",
          code: `{
  "dependencies": {
    "@sentry/nextjs": "^7.120.0"
  }
}`,
        },
        {
          filename: "sentry.client.config.ts",
          code: `import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "${dsn}",
});`,
        },
        {
          filename: "sentry.server.config.ts",
          code: `import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "${dsn}",
});`,
        },
      ],
    },
    {
      id: "python",
      label: "Python",
      logo: "python",
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
    {
      id: "go",
      label: "Go",
      logo: "go",
      files: [
        {
          filename: "go.mod",
          code: `require github.com/getsentry/sentry-go v0.28.0`,
        },
        {
          filename: "main.go",
          code: `import "github.com/getsentry/sentry-go"

err := sentry.Init(sentry.ClientOptions{
  Dsn: "${dsn}",
})`,
        },
      ],
    },
    {
      id: "php",
      label: "PHP",
      logo: "php",
      files: [
        {
          filename: "composer.json",
          code: `{
  "require": {
    "sentry/sentry": "^4.0"
  }
}`,
        },
        {
          filename: "index.php",
          code: `\\Sentry\\init(['dsn' => '${dsn}']);`,
        },
      ],
    },
    {
      id: "ruby",
      label: "Ruby",
      logo: "ruby",
      files: [
        {
          filename: "Gemfile",
          code: `gem "sentry-ruby"`,
        },
        {
          filename: "config/initializers/sentry.rb",
          code: `Sentry.init do |config|
  config.dsn = "${dsn}"
end`,
        },
      ],
    },
  ];
}

export function setupPlatformById(
  dsn: string,
  id: SetupPlatformId,
): SetupPlatformSnippet | undefined {
  return setupPlatformSnippets(dsn).find((platform) => platform.id === id);
}
