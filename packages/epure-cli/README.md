# @epure-sh/cli

[![npm version](https://img.shields.io/npm/v/@epure-sh/cli.svg)](https://www.npmjs.com/package/@epure-sh/cli)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

> Official Command-Line Interface for [Epure](https://epure.sh) — error triage, issue queues, demangled stack traces, and Agent API inspection.

---

## ⚡ Zero-Install Quickstart (via `npx`)

Run directly without installing:

```bash
export EPURE_TOKEN="epk_live_..."

# Verify token & organization role
npx @epure-sh/cli auth whoami

# Inspect unresolved issues
npx @epure-sh/cli --output table queue --limit 20
```

---

## 📦 Global Installation

```bash
npm install -g @epure-sh/cli

# Now you can use the 'epure' command directly:
epure auth whoami
epure queue
```

---

## 🛠️ Common Commands

### 1. View Unresolved Queue
```bash
epure queue --limit 25 --output table
```

### 2. Export Crash Context for Coding Agents
Export demangled stack traces and source lines to markdown:
```bash
epure context <ISSUE_UUID> --format markdown
# Or save directly to a file:
epure context <ISSUE_UUID> --format markdown --out bug-context.md
```

### 3. Triage & Resolve Issues
```bash
# Mark resolved with release tag
epure triage resolve <ISSUE_UUID> --release v1.2.0

# Snooze an issue for 24 hours
epure triage snooze <ISSUE_UUID> --mode hours

# Ignore issue from alerting
epure triage ignore <ISSUE_UUID>

# Reopen issue
epure triage reopen <ISSUE_UUID>
```

### 4. Self-Hosted Instances
Point to your own Epure deployment:
```bash
export EPURE_URL="https://errors.mycompany.com"
export EPURE_TOKEN="epk_..."
epure queue
```

---

## 📄 License

Apache-2.0 © Epure
