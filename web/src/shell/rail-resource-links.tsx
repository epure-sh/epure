import { BookOpen, History } from "lucide-react";
import { EPURE_CHANGELOG_URL, EPURE_DOCS_URL } from "../lib/docs-url";
import type { RailExternalLink } from "./rail-nav";

export const RAIL_RESOURCE_LINKS: RailExternalLink[] = [
  { href: EPURE_DOCS_URL, label: "Docs", icon: BookOpen },
  { href: EPURE_CHANGELOG_URL, label: "Changelog", icon: History },
];
