# Dual-Send ("Tee Mode") Transport

Send production telemetry simultaneously to both your existing Sentry project and Epure with zero migration risk during trial evaluations.

## 4-Line Implementation for `@sentry/nextjs`, `@sentry/react`, or `@sentry/browser`

```typescript
// sentry.client.config.ts / sentry.server.config.ts
import * as Sentry from "@sentry/nextjs";

function makeEpureTeeTransport(epureDsn: string, baseTransport = Sentry.makeFetchTransport) {
  const primary = baseTransport({ dsn: process.env.SENTRY_DSN! });
  const secondary = baseTransport({ dsn: epureDsn });

  return (options: any) => ({
    send: async (request: any) => {
      const [resPrimary] = await Promise.allSettled([
        primary.send(request),
        secondary.send(request),
      ]);
      return resPrimary.status === "fulfilled" ? resPrimary.value : Promise.reject(resPrimary.reason);
    },
    flush: async (timeout?: number) => {
      await Promise.allSettled([primary.flush(timeout), secondary.flush(timeout)]);
      return true;
    },
  });
}

// In your Sentry.init:
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  transport: makeEpureTeeTransport(process.env.EPURE_DSN!),
});
```

### Why Tee Mode Works
1. **Zero SDK change:** Keep all existing `@sentry/*` breadcrumbs, integrations, and exceptions.
2. **Asynchronous parallel send:** Both Sentry and Epure receive exceptions in parallel (`Promise.allSettled`).
3. **No double failure:** If one endpoint times out, the other is not blocked.
4. **Clean non-error absorption:** Epure absorbs non-error payloads (transactions, sessions) silently with `202 Accepted` while Sentry receives them normally.
