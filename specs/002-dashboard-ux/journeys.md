# 002-dashboard-ux — Journey proofs

Executable scenarios for publish gate. Record pass date + method in [quickstart.md](../001-phase-1-oss/quickstart.md) or here when done.

---

## J1 — First issue without README

**Persona:** P1 (indie dev, no Sentry background)

| Step | Action | Success |
|------|--------|---------|
| 1 | `docker compose up`, open app, register or dev login | Lands on Setup or Issues with setup prompt |
| 2 | Follow in-app setup | DSN copied to clipboard |
| 3 | Paste DSN in minimal SDK snippet (or curl fixture) | No need to open README |
| 4 | Return to Issues | First issue row visible; setup marked complete |

**Fail if:** user must read README to find DSN path or Settings tab name.

---

## J2 — Five-second scan

**Persona:** P1

| Step | Action | Success |
|------|--------|---------|
| 1 | Show Issues home to someone who didn't build it | They can say: "these are my crashes" and "how many are open" within 5s |

**Fail if:** they ask what `is:unresolved` means or where to click first.

---

## J3 — One-screen triage

**Persona:** P1 + P2

| Step | Action | Success |
|------|--------|---------|
| 1 | Click top issue | Overview tab shows title, status, last seen, environment |
| 2 | Without scrolling | Resolve and Ignore are visible |
| 3 | One click | Stack tab shows demangled frames |

**Fail if:** diff panel, merge bar, or keyboard hints visible before Stack tab.

---

## J4 — Power regression

**Persona:** P3

| Step | Action | Success |
|------|--------|---------|
| 1 | Open Filter | Query syntax and chips work |
| 2 | `j` / `k` | Selection moves |
| 3 | Select two issues | Merge works |
| 4 | `Cmd+Shift+C` | Export copies markdown |
| 5 | `cargo test` + 001 quickstart S4 rows | Still green |

**Fail if:** any 001 FEATURES Tier 4 proof breaks.

---

## J5 — Design QA

**Persona:** —

| Step | Action | Success |
|------|--------|---------|
| 1 | Run [design/QA.md](../../../../design/QA.md) on reskinned screens | All boxes checked |
| 2 | `/__design` lab | Primitives match feature usage |
