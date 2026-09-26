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
  | "ruby"
  | "java"
  | "dotnet";

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
  | "ruby"
  | "java"
  | "dotnet";

export interface SetupPlatformSnippet {
  id: SetupPlatformId;
  label: string;
  /** Brand logo under `public/frameworks/{logo}.svg`. */
  logo: SetupPlatformLogoId;
  files: SetupSnippetFile[];
}

export interface SetupSnippetOptions {
  environment?: string;
  release?: string;
}

function jsInitOptions(dsn: string, options?: SetupSnippetOptions): string {
  const lines = [`  dsn: "${dsn}",`];
  if (options?.environment) {
    lines.push(`  environment: "${options.environment}",`);
  }
  if (options?.release) {
    lines.push(`  release: "${options.release}",`);
  }
  return lines.join("\n");
}

function jsSentryInit(
  packageName: string,
  dsn: string,
  options?: SetupSnippetOptions,
): string {
  return `import * as Sentry from "${packageName}";

Sentry.init({
${jsInitOptions(dsn, options)}
});`;
}

export function setupPlatformSnippets(
  dsn: string,
  options?: SetupSnippetOptions,
): SetupPlatformSnippet[] {
  const env = options?.environment;
  const release = options?.release;

  const pythonKwargs = [
    `    dsn="${dsn}",`,
    env ? `    environment="${env}",` : null,
    release ? `    release="${release}",` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const goFields = [
    `  Dsn: "${dsn}",`,
    env ? `  Environment: "${env}",` : null,
    release ? `  Release: "${release}",` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const phpPairs = [
    `'dsn' => '${dsn}'`,
    env ? `'environment' => '${env}'` : null,
    release ? `'release' => '${release}'` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const rubyLines = [
    `  config.dsn = "${dsn}"`,
    env ? `  config.environment = "${env}"` : null,
    release ? `  config.release = "${release}"` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const javaLines = [
    `    options.setDsn("${dsn}");`,
    env ? `    options.setEnvironment("${env}");` : null,
    release ? `    options.setRelease("${release}");` : null,
    `    options.setTracesSampleRate(0.0);`,
    `    options.setProfilesSampleRate(0.0);`,
  ]
    .filter(Boolean)
    .join("\n");

  const dotnetLines = [
    `    options.Dsn = "${dsn}";`,
    env ? `    options.Environment = "${env}";` : null,
    release ? `    options.Release = "${release}";` : null,
    `    options.TracesSampleRate = 0.0;`,
    `    options.ProfilesSampleRate = 0.0;`,
  ]
    .filter(Boolean)
    .join("\n");

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
          code: jsSentryInit("@sentry/browser", dsn, options),
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
          code: jsSentryInit("@sentry/browser", dsn, options),
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
          code: jsSentryInit("@sentry/node", dsn, options),
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
          code: jsSentryInit("@sentry/react", dsn, options),
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
          code: jsSentryInit("@sentry/nextjs", dsn, options),
        },
        {
          filename: "sentry.server.config.ts",
          code: jsSentryInit("@sentry/nextjs", dsn, options),
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
${pythonKwargs}
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
${goFields}
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
          code: `\\Sentry\\init([${phpPairs}]);`,
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
${rubyLines}
end`,
        },
      ],
    },
    {
      id: "java",
      label: "Java",
      logo: "java",
      files: [
        {
          filename: "install",
          code: `# add io.sentry:sentry via Maven or Gradle`,
        },
        {
          filename: "Application.java",
          code: `Sentry.init(options -> {
${javaLines}
});`,
        },
      ],
    },
    {
      id: "dotnet",
      label: ".NET",
      logo: "dotnet",
      files: [
        {
          filename: "install",
          code: `dotnet add package Sentry`,
        },
        {
          filename: "Program.cs",
          code: `SentrySdk.Init(options =>
{
${dotnetLines}
});`,
        },
      ],
    },
  ];
}

export function setupPlatformById(
  dsn: string,
  id: SetupPlatformId,
  options?: SetupSnippetOptions,
): SetupPlatformSnippet | undefined {
  return setupPlatformSnippets(dsn, options).find((platform) => platform.id === id);
}
