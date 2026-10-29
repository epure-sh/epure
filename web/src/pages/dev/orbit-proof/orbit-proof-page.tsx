import { Box } from "@polar-sh/orbit/Box";
import { Button } from "@polar-sh/orbit/Button";
import { Text } from "@polar-sh/orbit/Text";
import { useThemeMode } from "@/lib/style-theme";
import { isPlaygroundMode } from "@/lib/deployment";
import { Navigate, Link } from "react-router-dom";
import { OrbitRecipesSection } from "./orbit-recipes";

const SEMANTIC_BACKGROUNDS = [
  "background-primary",
  "background-secondary",
  "background-card",
  "background-inverse",
  "background-accent",
  "background-warning",
  "background-success",
  "background-danger",
] as const;

/**
 * Phase 0 toolchain proof: Orbit Box / Text / Button + semantic backgrounds.
 * Does not replace Epure UI — only proves StyleX + vendored Orbit resolve in Vite.
 */
export function OrbitProofPage() {
  const [themeMode, toggleThemeMode] = useThemeMode();

  if (!isPlaygroundMode() && !import.meta.env.DEV) {
    return <Navigate to="/" replace />;
  }

  return (
    <Box
      as="main"
      flexDirection="column"
      rowGap="xl"
      padding="xl"
      backgroundColor="background-primary"
      minHeight="100dvh"
      width="100%"
    >
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="between"
        columnGap="m"
        width="100%"
      >
        <Box flexDirection="column" rowGap="xs">
          <Text variant="heading-m">Orbit proof</Text>
          <Text color="muted">
            Phases 0–5 — Orbit theme, kit chrome, /__design registry Docs. Phase 6 is
            product surfaces (feed, telemetry, copilot, shell).
          </Text>
        </Box>
        <Box alignItems="center" columnGap="s">
          <Button variant="secondary" size="sm" onClick={toggleThemeMode}>
            {themeMode === "dark" ? "Light" : "Dark"}
          </Button>
          <Link to="/__design">
            <Text as="span" variant="label" color="accent">
              ← Design kit
            </Text>
          </Link>
        </Box>
      </Box>

      <Box flexDirection="column" rowGap="m" width="100%">
        <Text variant="heading-xs">Semantic backgrounds</Text>
        <Box
          display="grid"
          gridTemplateColumns="repeat(auto-fill, minmax(160px, 1fr))"
          gap="m"
          width="100%"
        >
          {SEMANTIC_BACKGROUNDS.map((token) => (
            <Box
              key={token}
              flexDirection="column"
              rowGap="s"
              padding="m"
              backgroundColor={token}
              borderRadius="m"
              borderWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
              minHeight={96}
              justifyContent="end"
              color={token === "background-inverse" ? "text-primary" : "text-secondary"}
            >
              <Text as="span" variant="label" color="inherit">
                {token}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>

      <Box flexDirection="column" rowGap="m" width="100%">
        <Text variant="heading-xs">Typography + Button</Text>
        <Box
          flexDirection="column"
          rowGap="s"
          padding="l"
          backgroundColor="background-card"
          borderRadius="m"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          width="100%"
          maxWidth={480}
        >
          <Text variant="heading-s">Card title (heading-s)</Text>
          <Text color="muted">
            Body copy on a background-card surface. Tokens auto-resolve light/dark via
            light-dark() + LightningCSS polyfill.
          </Text>
          <Box columnGap="s" alignItems="center" marginTop="s">
            <Button variant="default" size="sm">
              Primary
            </Button>
            <Button variant="secondary" size="sm">
              Secondary
            </Button>
            <Button variant="outline" size="sm">
              Outline
            </Button>
          </Box>
        </Box>
      </Box>

      <OrbitRecipesSection />
    </Box>
  );
}
