// src/components/kit/code-frame.tsx — Phase 4: Orbit Box/Text chrome (Shiki body kept)
import * as React from "react";
import { codeToHtml } from "shiki";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "@/components/ui/icon";

export interface CodeFrameProps {
  code: string;
  language?: string;
  filename?: string;
  highlightLine?: number;
  /** Cap the code body height (e.g. "9.5rem") — one scroll region inside the frame. */
  maxBodyHeight?: string;
  className?: string;
}

export function CodeFrame({
  code,
  language = "typescript",
  filename,
  highlightLine,
  maxBodyHeight,
  className,
}: CodeFrameProps) {
  const [highlightedHtml, setHighlightedHtml] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [theme, setTheme] = React.useState<"vitesse-dark" | "vitesse-light">("vitesse-dark");

  React.useEffect(() => {
    const root = document.documentElement;
    const resolve = () => {
      const mode =
        root.getAttribute("data-theme") === "light" || root.classList.contains("light")
          ? "vitesse-light"
          : "vitesse-dark";
      setTheme(mode);
    };
    resolve();
    const observer = new MutationObserver(resolve);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    codeToHtml(code, {
      lang: language,
      theme,
    })
      .then((html) => {
        if (!cancelled) {
          setHighlightedHtml(html);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHighlightedHtml(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, language, theme]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard write failed
    }
  };

  const lines = React.useMemo(() => code.split("\n"), [code]);

  return (
    <Box
      data-slot="code-frame"
      borderRadius="m"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor="background-primary"
      boxShadow="s"
      overflow="hidden"
      flexDirection="column"
      // eslint-disable-next-line no-restricted-syntax -- kit API className
      className={className}
    >
      <Box
        alignItems="center"
        justifyContent="between"
        height={32}
        flexShrink={0}
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        backgroundColor="background-card"
        paddingHorizontal="m"
        userSelect="none"
      >
        <Box alignItems="center" columnGap="s">
          {filename ? (
            <Text as="span" variant="label">
              {filename}
            </Text>
          ) : null}
          <Box
            as="span"
            borderRadius="s"
            borderWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
            backgroundColor="background-secondary"
            paddingHorizontal="xs"
            paddingVertical="xs"
          >
            <Text as="span" variant="caption" color="muted" monospace>
              {language}
            </Text>
          </Box>
        </Box>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleCopy}
          title={copied ? "Copied" : "Copy snippet"}
        >
          {copied ? <Check size={12} weight="bold" /> : <Copy size={12} />}
        </Button>
      </Box>

      <Box
        overflowX="auto"
        overflowY={maxBodyHeight ? "auto" : undefined}
        padding="m"
        // eslint-disable-next-line no-restricted-syntax -- optional body height cap for compact embeds
        style={maxBodyHeight ? { maxHeight: maxBodyHeight } : undefined}
      >
        {highlightedHtml ? (
          <Box
            // Shiki HTML glue — keep pre/code styling from highlighter.
            // eslint-disable-next-line no-restricted-syntax -- third-party shiki class hooks
            className={
              maxBodyHeight
                ? "[&>pre]:!bg-transparent [&>pre]:!p-0 [&>pre]:!m-0 [&>pre]:!overflow-visible [&_code]:font-mono [&_code]:whitespace-pre-wrap [&_code]:break-all text-xs"
                : "[&>pre]:!bg-transparent [&>pre]:!p-0 [&>pre]:!m-0 [&_code]:font-mono text-xs"
            }
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <Box flexDirection="column" color="text-secondary">
            {lines.map((line, idx) => {
              const lineNum = idx + 1;
              const isTarget = highlightLine === lineNum;
              return (
                <Box
                  key={idx}
                  alignItems="start"
                  columnGap="m"
                  paddingHorizontal="xs"
                  backgroundColor={isTarget ? "background-danger" : undefined}
                  borderLeftWidth={isTarget ? 2 : 0}
                  borderStyle={isTarget ? "solid" : undefined}
                  borderColor={isTarget ? "border-warning" : undefined}
                >
                  <Box width={32} flexShrink={0}>
                    <Text
                      as="span"
                      variant="caption"
                      color="muted"
                      monospace
                      tabularNums
                      align="right"
                    >
                      {lineNum}
                    </Text>
                  </Box>
                  <Box flex={1}>
                    <Text
                      as="span"
                      variant="caption"
                      monospace
                      wrap={maxBodyHeight ? "wrap" : "nowrap"}
                    >
                      {line || " "}
                    </Text>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
}
