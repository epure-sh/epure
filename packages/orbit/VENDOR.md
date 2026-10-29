# Vendored `@polar-sh/orbit`

| Field | Value |
|---|---|
| Upstream | https://github.com/polarsource/polar |
| Path | `clients/packages/orbit` |
| Package | `@polar-sh/orbit` 0.1.0 |
| License | Apache-2.0 |
| Commit | See `.vendor-commit` |

## Why vendored

Orbit is marked `"private": true` and is **not published to npm**. Epure consumes
it as a workspace/file package so imports stay on the public Polar API surface:

```ts
import { Box } from '@polar-sh/orbit/Box'
import { Text, Button } from '@polar-sh/orbit'
import * as tokens from '@polar-sh/orbit/theme'
```

## Refresh

```bash
# from a temp sparse clone of polarsource/polar @ desired SHA
rsync -a --delete --exclude node_modules --exclude dist \
  /path/to/polar/clients/packages/orbit/src \
  apps/epure/packages/orbit/
git -C /path/to/polar rev-parse HEAD > apps/epure/packages/orbit/.vendor-commit
# re-resolve catalog: versions in package.json if Polar bumped deps
```

Do **not** rewrite Polar source casually — prefer upstream bumps + re-vendor.
Epure-specific theme/fonts land in the web app (Phase 3+), not here.
