import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import { DocsPageHeader } from "./page-header";
import { DocsSection } from "./section";
import {
  DocsH2,
  DocsH3,
  DocsLead,
  DocsList,
  DocsP,
  DocsProse,
  DocsRuleCard,
} from "./prose";

/**
 * Full Polar handbook.polar.sh/design content for agents.
 * Source: https://handbook.polar.sh/design/ (+ ADR-0004).
 * Do not thin-summarize — this is the canonical in-app copy.
 */

export function HandbookIntroPage() {
  return (
    <Box id="handbook" flexDirection="column" width="100%">
      <DocsPageHeader
        eyebrow="Polar Handbook · Design"
        title="Design at Polar"
        description="Our design vision, principles, and the standards that guide every decision. Design at Polar is not how things look. It is how the system thinks."
      />
      <DocsSection>
        <DocsProse>
          <DocsP>
            The best design we will ever produce is a billing infrastructure so precise, so
            automatic, so well-considered that the founders using it stop thinking about billing
            entirely. That is the design vision. Not a beautiful dashboard, though we will build
            one. Not a considered typeface, though we will choose one carefully. The vision is
            invisibility achieved through exactness. Infrastructure so well designed it disappears.
          </DocsP>
          <DocsP>
            Dieter Rams said it first: good design is as little design as possible. We take that
            seriously.
          </DocsP>

          <DocsH2>The governing principle</DocsH2>
          <DocsLead>Design by subtraction.</DocsLead>
          <DocsP>
            Every decision starts with removal. We add only what the system demands. Nothing is
            decorative, nothing is arbitrary. Every element exists because the logic requires it.
            This is not minimalism as aesthetic preference. It is minimalism as discipline.
          </DocsP>

          <DocsH2>What&apos;s inside</DocsH2>
          <DocsList
            items={[
              "Principles — The three rules that govern every design decision at Polar.",
              "Product Design — How the principles apply to the product we build.",
              "Visual Design — The visual world, typography, and motion.",
              "Voice & Tone — How Polar sounds, in writing.",
              "LLM contract — ADR-0004 + Epure Orbit rules agents must follow.",
            ]}
          />

          <DocsH2>Perception pillars</DocsH2>
          <DocsP>How Polar should land, in three stages.</DocsP>
          <DocsH3>At first contact</DocsH3>
          <DocsP>
            Unlike anything else in the category. A founder lands on the site and immediately knows
            this wasn&apos;t built by a fintech company. The aesthetic is precise and considered. The
            copy is direct and intelligent. Nothing is trying too hard. Everything signals that the
            people who built this have been in the room.
          </DocsP>
          <DocsH3>After engaging</DocsH3>
          <DocsP>
            Excited. Not in a features-and-benefits way. In a &quot;I want to build with this&quot; way.
            Polar should feel like discovering the tool you didn&apos;t know you were waiting for. The
            kind of thing you screenshot and send to your co-founder.
          </DocsP>
          <DocsH3>Over time</DocsH3>
          <DocsP>
            Trusted. The excitement converts to confidence. Polar becomes the part of the stack that
            founders stop thinking about, because it just works, precisely and automatically, every
            time.
          </DocsP>

          <DocsH2>Brand pillars</DocsH2>
          <DocsP>The four things Polar should communicate, in the founder&apos;s own words.</DocsP>
          <DocsH3>These people get it</DocsH3>
          <DocsP>
            Polar demonstrates an intimate understanding of the applied AI founder&apos;s reality: the
            inference costs, the pricing complexity, the speed at which everything moves. The brand
            earns immediate credibility by speaking the right language in the right way.
          </DocsP>
          <DocsH3>This is different</DocsH3>
          <DocsP>
            Everything about Polar — the aesthetic, the voice, the point of view — signals that this
            wasn&apos;t built by a fintech company that added AI features. It was built from scratch for
            a specific moment and a specific audience. That difference is felt immediately.
          </DocsP>
          <DocsH3>I want to build with this</DocsH3>
          <DocsP>
            Polar generates excitement, not about billing, but about what becomes possible when
            billing is handled. The brand surfaces the outcome: faster launches, cleaner margins,
            sustainable revenue from day one. That&apos;s the thing worth being excited about.
          </DocsP>
          <DocsH3>This is serious infrastructure</DocsH3>
          <DocsP>
            Beneath the personality and the point of view is a system that works. Polar&apos;s brand
            communicates precision, reliability, and depth. Applied AI founders are technical. They
            need to trust the foundation before they build on it.
          </DocsP>

          <DocsH2>The design ambition</DocsH2>
          <DocsP>
            We are not designing a billing product. We are designing the financial infrastructure
            for the applied AI era — the layer that makes every applied AI company&apos;s unit economics
            work.
          </DocsP>
          <DocsP>
            That is a serious problem and it deserves serious design. Not serious as in heavy or
            corporate or cold. Serious as in considered, precise, and completely intentional. The
            kind of serious that earns trust before a word is read. The kind of serious that makes
            an applied AI founder screenshot the homepage and send it to their co-founder.
          </DocsP>
          <DocsP>That is what we are building toward — and what Epure inherits via Orbit.</DocsP>
        </DocsProse>
      </DocsSection>
    </Box>
  );
}

export function HandbookPrinciplesPage() {
  return (
    <Box id="principles" flexDirection="column" width="100%">
      <DocsPageHeader
        eyebrow="Polar Handbook · Design"
        title="Design Principles"
        description="The three rules that govern every design decision at Polar. They are ordered: when they conflict, the earlier one wins."
      />
      <DocsSection>
        <Box flexDirection="column" rowGap="l" width="100%">
          <DocsRuleCard
            index="01"
            title="Design by subtraction"
            lead="Start with everything. Remove until only what is necessary remains. Then remove one more thing. What survives is the design."
            body="Orbit ships one spacing scale, a handful of radii, and a small set of semantic colors. The constraint is the feature. Fewer choices means fewer ways to drift, so every surface reads as one system."
          />
          <DocsRuleCard
            index="02"
            title="Derived, not decorated"
            lead="Every visual element should feel like it emerged from an underlying rule, not a designer's preference. Beauty is a byproduct of correctness."
            body="Polar does not have a visual personality in the conventional sense. It has a visual logic. The temptation to express, to decorate, to add warmth or character through aesthetics: we resist it. The character lives in the point of view, the copy, the product decisions. The design gets out of the way. Color resolves from light-dark(), spacing from a single scale, motion from physical curves."
          />
          <DocsRuleCard
            index="03"
            title="Precision as respect"
            lead="Our audience is technical. They pattern-match fast and trust slowly. Every pixel, every word, every interaction that is imprecise is a signal that we don't understand their world."
            body="Precision is not a quality standard. It is a form of respect. Box makes precision the default by removing arbitrary values: typed props take tokens, never raw pixels, so the easy path and the correct path are the same."
          />
        </Box>
      </DocsSection>
    </Box>
  );
}

export function HandbookProductDesignPage() {
  return (
    <Box id="product-design" flexDirection="column" width="100%">
      <DocsPageHeader
        eyebrow="Polar Handbook · Design"
        title="Product Design"
        description="How the design principles apply to the product. The product should feel like a precision instrument — not software that processes data, an instrument that measures, captures, and converts with exactness."
      />
      <DocsSection>
        <DocsProse>
          <DocsH2>Data is the design</DocsH2>
          <DocsP>
            In a billing product, numbers are the primary content. The design system exists to make
            data legible, scannable, and trustworthy at a glance. Typography, spacing, and hierarchy
            serve the number, not the other way around. For Epure: issue counts, alert severity,
            telemetry series, and usage meters are the content — chrome exists to make them exact.
          </DocsP>

          <DocsH2>Density with clarity</DocsH2>
          <DocsP>
            Applied AI founders need to see a lot of information quickly. The product doesn&apos;t hide
            complexity behind progressive disclosure and empty states. It presents information
            densely, precisely, and trusts the user to navigate it. Clarity is achieved through
            hierarchy, not simplicity.
          </DocsP>

          <DocsH2>Zero polish debt</DocsH2>
          <DocsP>
            Every screen, every state, every edge case is designed with the same precision as the
            primary flow. Empty states are not afterthoughts. Error states are not apologies. Every
            moment a user encounters the product is a moment they are forming a judgment about
            precision. We treat every state as primary.
          </DocsP>

          <DocsH2>Speed as a design value</DocsH2>
          <DocsP>
            The product should feel fast in every sense. Fast to load, fast to understand, fast to
            act on. Latency is a design failure. Cognitive load is a design failure. Every
            additional second spent understanding the product is a second not spent building.
          </DocsP>

          <DocsH2>The artifact principle</DocsH2>
          <DocsP>
            Polar treats the invoice as a design artifact — the most tangible expression of the
            system in the world. Epure&apos;s equivalent: issue rows, alert cards, and code frames that
            leave the product and land in an agent&apos;s or engineer&apos;s workflow. Those surfaces deserve
            the same typographic exactness and informational clarity.
          </DocsP>
        </DocsProse>
      </DocsSection>
    </Box>
  );
}

export function HandbookVisualDesignPage() {
  return (
    <Box id="visual-design" flexDirection="column" width="100%">
      <DocsPageHeader
        eyebrow="Polar Handbook · Design"
        title="Visual Design"
        description="The visual world, typography, and motion. Constructed from three references held in tension — not styled, but derived."
      />
      <DocsSection>
        <DocsProse>
          <DocsP>
            The Polar visual world is constructed from three references held in tension.
          </DocsP>
          <DocsH3>Mathematical precision</DocsH3>
          <DocsP>
            The visual language of systems that are exact because they must be. Scientific
            instruments, technical drawings, geometric construction. Every line placed because the
            geometry demands it.
          </DocsP>
          <DocsH3>Magnetism</DocsH3>
          <DocsP>
            Invisible forces made visible. Field lines, poles, attraction and repulsion. The physics
            of Polar expressed as visual texture. The brand has a polarity: cold precision on the
            surface, warm revenue at the center.
          </DocsP>
          <DocsH3>Polar coordinates</DocsH3>
          <DocsP>
            Radial systems, angles and distance from a fixed origin. A fundamentally different way
            of mapping space. Also: the north star, the fixed point everything else orients around.
          </DocsP>
          <DocsP>
            Together these create a world that is systematic and generative. Dark, exact, and alive
            in a way that polished digital surfaces never are.
          </DocsP>

          <DocsH2>Typography</DocsH2>
          <DocsP>
            Upstream handbook marks typography &quot;to be defined.&quot; Epure / Orbit ships Inter for UI and
            Geist Mono for code and tabular data. Use Text variants — never invent a type size. Prefer
            heading-* for titles, body for copy, label / caption for chrome, monospace for IDs and
            counts.
          </DocsP>

          <DocsH2>Motion</DocsH2>
          <DocsP>
            Motion at Polar obeys physics. Nothing bounces, springs, or eases playfully. Elements
            construct themselves. Lines draw. Forms assemble. Particles accumulate. Numbers count
            with mechanical precision.
          </DocsP>
          <DocsP>
            Transitions suggest duration rather than speed — the visual language of accumulation, of
            events building over time. In Orbit: duration tokens (instant / fast / base / slow /
            slower) and ease tokens (standard / decelerate / accelerate / spring). Prefer
            decelerate for enter, accelerate for exit. No playful bounce on product chrome.
          </DocsP>
        </DocsProse>
      </DocsSection>
    </Box>
  );
}

export function HandbookVoiceTonePage() {
  return (
    <Box id="voice-tone" flexDirection="column" width="100%">
      <DocsPageHeader
        eyebrow="Polar Handbook · Design"
        title="Voice & Tone"
        description="How Polar sounds in writing. Epure copy in UI, empty states, errors, and docs follows the same rules."
      />
      <DocsSection>
        <DocsProse>
          <DocsP>
            Polar sounds like a founder who&apos;s felt the exact pain the product solves. Who&apos;s
            duct-taped billing together at 2am, watched inference costs eat their margin, and wished
            something like this existed. That experience is the voice.
          </DocsP>

          <DocsH2>Write like a developer</DocsH2>
          <DocsP>
            Short sentences. Active voice. No throat-clearing. Get to the point in the first line
            and stay there. If it can be said in five words, say it in five words.
          </DocsP>

          <DocsH2>Have a point of view</DocsH2>
          <DocsP>
            Polar is opinionated. It knows what good looks like and isn&apos;t shy about it. Wishy-washy
            language — &quot;we think,&quot; &quot;we believe,&quot; &quot;it might be&quot; — doesn&apos;t exist here. State the
            thing.
          </DocsP>

          <DocsH2>Never sound like fintech</DocsH2>
          <DocsP>
            No compliance voice. No &quot;we take security seriously.&quot; No &quot;seamless experiences.&quot; No
            enthusiasm about money that feels performed. The outcome is the personality, not the
            jargon.
          </DocsP>

          <DocsH2>Writing principles</DocsH2>
          <DocsList
            items={[
              "Lead with the thing. Never bury the point. The first sentence of a headline, doc section, error message, or email should contain the most important information.",
              "Short sentences over long ones. If a sentence has more than two clauses, break it. Complexity in ideas is fine. Complexity in sentences isn't.",
              'Active voice, always. "Polar meters your usage" not "your usage is metered by Polar." The product does things. Write like it does.',
              'Specificity over generality. "Bills per token" beats "flexible usage-based pricing." Concrete details beat abstract claims.',
              "Omit needless words. Read everything back and cut every word that isn't earning its place. Then read it again.",
              "Don't explain what's obvious. The audience is technical. Assuming intelligence is itself a form of respect.",
              "Humor is dry, never performed. Wit comes from precision and understatement, not exclamation points.",
              "Consistency in terminology. Pick the right word for a concept and use it every time. Precision means consistency.",
            ]}
          />
        </DocsProse>
      </DocsSection>
    </Box>
  );
}

export function HandbookLlmContractPage() {
  return (
    <Box id="llm-contract" flexDirection="column" width="100%">
      <DocsPageHeader
        eyebrow="ADR-0004 · Epure contract"
        title="LLM-safe Orbit"
        description="Frontend UI is authored with Orbit Box and design tokens. Raw div plus Tailwind is deprecated. Docs suggest; npm run lint enforces."
      />
      <DocsSection title="Context (ADR-0004)">
        <DocsProse>
          <DocsP>
            Raw div plus Tailwind lets anyone (human or agent) invent off-scale spacing and colors,
            forget theme variants, and none of it is type-checked. As AI-authored UI grew, that
            freedom became a consistency and correctness problem.
          </DocsP>
          <DocsH2>Decision</DocsH2>
          <DocsP>
            Author UI with Box (from @polar-sh/orbit/Box) and Text (from @polar-sh/orbit/Text),
            passing design tokens as typed props. Raw HTML plus Tailwind for layout, spacing, color,
            border, radius, shadow, flex, grid, and position is deprecated. Tokens are two-tiered
            (primitive values feed semantic names); props take token names, never raw values.
            Tailwind remains only for third-party override classNames and temporary glue while
            migrating legacy files.
          </DocsP>
          <DocsH2>Consequences</DocsH2>
          <DocsList
            items={[
              "Token props resolve light and dark automatically — no per-element theme duplication; off-token values become unwriteable.",
              "ESLint orbitZoneFiles + restricted syntax enforce the contract in Epure (same bet as Polar Oxlint plugins).",
              "Editing a legacy Tailwind file? Migrate it to Box rather than extend the Tailwind.",
            ]}
          />
        </DocsProse>
      </DocsSection>
      <DocsSection title="Epure agent rules (do not weaken)">
        <DocsProse>
          <DocsList
            items={[
              "Tokens are decisions, not values — background-card, padding=\"l\", not bg-gray-100 / p-4.",
              "Box is the only layout container — polymorphic as for semantics; bare <div> is unavailable in the Orbit zone.",
              "Docs are a suggestion; npm run lint is the contract. Green = mergeable.",
              "Escape hatches are cracks — prefer adding a token over className / inline style.",
              "Never className / style on Box or Text.",
              "Closed kit APIs — no public className on PageShell, EmptyState, SectionCard, PolarCard, …",
              "Record tables → @/components/kit/data-table. Markup tables → @/components/ui/table.",
            ]}
          />
          <DocsH2>Copy-paste import</DocsH2>
          <Text variant="body" monospace as="p">
            {`import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit/Text'
import { Button, Grid, Spinner } from '@polar-sh/orbit'`}
          </Text>
          <DocsP>
            Full recipes live under Recipes in this catalog. Markdown: design/ORBIT_CONTRACT.md,
            design/ORBIT_RECIPES.md, AGENTS.md. Upstream reference: orbit.polar.sh.
          </DocsP>
        </DocsProse>
      </DocsSection>
    </Box>
  );
}
