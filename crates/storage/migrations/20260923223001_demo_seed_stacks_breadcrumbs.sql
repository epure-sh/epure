-- Richer demo seed payloads: stack frames + breadcrumbs for register bootstrap.
-- Safe to re-run: replaces auth_bootstrap_workspace only (no schema change).

DROP FUNCTION IF EXISTS auth_bootstrap_workspace(uuid, uuid, text);

DROP FUNCTION IF EXISTS auth_bootstrap_workspace(uuid, uuid, text, text, text);

CREATE OR REPLACE FUNCTION auth_bootstrap_workspace(
    p_user_id uuid,
    p_org_id uuid,
    p_org_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_web_id uuid := gen_random_uuid();
    v_api_id uuid := gen_random_uuid();
    v_slug_suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    v_now timestamptz := now();
    v_issue_id uuid;
BEGIN
    INSERT INTO organizations (id, name) VALUES (p_org_id, p_org_name);

    INSERT INTO projects (id, org_id, name, slug, retention_days, ingest_cap_per_hour, is_demo)
    VALUES
        (v_web_id, p_org_id, 'Acme Web', 'acme-web-' || v_slug_suffix, 30, 5000, true),
        (v_api_id, p_org_id, 'Acme API', 'acme-api-' || v_slug_suffix, 30, 5000, true);

    INSERT INTO org_members (org_id, user_id, role)
    VALUES (p_org_id, p_user_id, 'owner');

    INSERT INTO dsn_keys (project_id, public_key, secret_key, label)
    VALUES
        (
            v_web_id,
            substr(replace(gen_random_uuid()::text, '-', ''), 1, 20),
            convert_to('demo-preview-key-not-for-prod', 'UTF8'),
            'Demo browser'
        ),
        (
            v_api_id,
            substr(replace(gen_random_uuid()::text, '-', ''), 1, 20),
            convert_to('demo-preview-key-not-for-prod', 'UTF8'),
            'Demo API'
        );

    PERFORM ensure_event_partition(
        EXTRACT(YEAR FROM v_now)::int,
        EXTRACT(MONTH FROM v_now)::int
    );

    v_issue_id := gen_random_uuid();
    INSERT INTO issues (
        id, org_id, project_id, fingerprint, title, status, level,
        first_seen_at, last_seen_at, event_count, unique_user_count,
        environment, release
    ) VALUES (
        v_issue_id, p_org_id, v_web_id, 'demo-web-checkout-typeerror',
        'TypeError: Cannot read properties of undefined (reading ''price'')',
        'unresolved', 'error', v_now - interval '2 days', v_now - interval '1 hour',
        5, 3, 'production', 'web@2.14.0'
    );
    INSERT INTO events (
        id, org_id, project_id, issue_id, occurred_at, environment, release,
        platform, runtime_name, runtime_version, browser_name, os_name,
        user_id, user_email, payload_json, stack_frames, breadcrumbs
    ) VALUES (
        gen_random_uuid(), p_org_id, v_web_id, v_issue_id, v_now - interval '1 hour',
        'production', 'web@2.14.0', 'javascript',
        'browser', '128.0.0.0', 'Chrome', 'macOS',
        'usr_8f3a2b1c', 'alice@acme-corp.com',
        $p0payload${"platform":"javascript","level":"error","environment":"production","release":"web@2.14.0","transaction":"/checkout","tags":{"feature":"checkout","page":"checkout"},"user":{"id":"usr_8f3a2b1c","email":"alice@acme-corp.com","username":"alice"},"contexts":{"browser":{"name":"Chrome","version":"128.0.0.0"},"os":{"name":"macOS","version":"14.6"},"runtime":{"name":"browser","version":"128.0.0.0"}},"request":{"url":"https://app.acme-corp.com/checkout","method":"GET","headers":{"User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}},"exception":{"values":[{"type":"TypeError","value":"Cannot read properties of undefined (reading 'price')","stacktrace":{"frames":[{"filename":"webpack:///./node_modules/react-dom/cjs/react-dom.production.min.js","function":"Object.invokeGuardedCallbackDev","lineno":4213,"colno":16,"in_app":false},{"filename":"webpack:///./src/hooks/useCart.ts","function":"calculateTotal","lineno":34,"colno":58,"in_app":true,"context_line":"  return items.reduce((sum, item) => sum + item.price, 0);","pre_context":["export function calculateTotal(items: CartItem[] | undefined) {","  if (!items?.length) return 0;"],"post_context":["}",""]},{"filename":"webpack:///./src/components/CheckoutForm.tsx","function":"handleSubmit","lineno":87,"colno":19,"in_app":true,"context_line":"    const total = calculateTotal(cart.items);","pre_context":["  const handleSubmit = async () => {","    setSubmitting(true);"],"post_context":["    await submitOrder({ total });","  };"]},{"filename":"webpack:///./src/components/CheckoutForm.tsx","function":"onClick","lineno":142,"colno":7,"in_app":true,"context_line":"      handleSubmit();","pre_context":["    <Button","      onClick={() => {"],"post_context":["      }}","    >"]}]}}]},"breadcrumbs":{"values":[{"timestamp":1726214400.12,"type":"navigation","category":"navigation","level":"info","message":"Navigated to /cart"},{"timestamp":1726214402.45,"type":"default","category":"ui.click","level":"info","message":"body > div#root > main > button.checkout-cta","data":{"label":"Proceed to checkout"}},{"timestamp":1726214403.01,"type":"navigation","category":"navigation","level":"info","message":"Navigated to /checkout"},{"timestamp":1726214405.88,"type":"http","category":"fetch","level":"info","message":"GET /api/cart","data":{"method":"GET","url":"/api/cart","status_code":200}},{"timestamp":1726214408.33,"type":"default","category":"ui.click","level":"info","message":"Place order","data":{"label":"Place order"}},{"timestamp":1726214408.91,"type":"default","category":"console","level":"error","message":"TypeError: Cannot read properties of undefined (reading 'price')"}]}}$p0payload$::jsonb,
        $p0frames$[{"filename":"webpack:///./node_modules/react-dom/cjs/react-dom.production.min.js","function":"Object.invokeGuardedCallbackDev","lineno":4213,"colno":16,"in_app":false},{"filename":"webpack:///./src/hooks/useCart.ts","function":"calculateTotal","lineno":34,"colno":58,"in_app":true,"context_line":"  return items.reduce((sum, item) => sum + item.price, 0);","pre_context":["export function calculateTotal(items: CartItem[] | undefined) {","  if (!items?.length) return 0;"],"post_context":["}",""]},{"filename":"webpack:///./src/components/CheckoutForm.tsx","function":"handleSubmit","lineno":87,"colno":19,"in_app":true,"context_line":"    const total = calculateTotal(cart.items);","pre_context":["  const handleSubmit = async () => {","    setSubmitting(true);"],"post_context":["    await submitOrder({ total });","  };"]},{"filename":"webpack:///./src/components/CheckoutForm.tsx","function":"onClick","lineno":142,"colno":7,"in_app":true,"context_line":"      handleSubmit();","pre_context":["    <Button","      onClick={() => {"],"post_context":["      }}","    >"]}]$p0frames$::jsonb,
        $p0crumbs$[{"timestamp":1726214400.12,"type":"navigation","category":"navigation","level":"info","message":"Navigated to /cart"},{"timestamp":1726214402.45,"type":"default","category":"ui.click","level":"info","message":"body > div#root > main > button.checkout-cta","data":{"label":"Proceed to checkout"}},{"timestamp":1726214403.01,"type":"navigation","category":"navigation","level":"info","message":"Navigated to /checkout"},{"timestamp":1726214405.88,"type":"http","category":"fetch","level":"info","message":"GET /api/cart","data":{"method":"GET","url":"/api/cart","status_code":200}},{"timestamp":1726214408.33,"type":"default","category":"ui.click","level":"info","message":"Place order","data":{"label":"Place order"}},{"timestamp":1726214408.91,"type":"default","category":"console","level":"error","message":"TypeError: Cannot read properties of undefined (reading 'price')"}]$p0crumbs$::jsonb
    );

    v_issue_id := gen_random_uuid();
    INSERT INTO issues (
        id, org_id, project_id, fingerprint, title, status, level,
        first_seen_at, last_seen_at, event_count, unique_user_count,
        environment, release
    ) VALUES (
        v_issue_id, p_org_id, v_web_id, 'demo-web-payment-failed',
        'Error: Payment failed: card declined (500)',
        'unresolved', 'error', v_now - interval '5 days', v_now - interval '3 hours',
        3, 2, 'production', 'web@2.14.0'
    );
    INSERT INTO events (
        id, org_id, project_id, issue_id, occurred_at, environment, release,
        platform, runtime_name, runtime_version, browser_name, os_name,
        user_id, user_email, payload_json, stack_frames, breadcrumbs
    ) VALUES (
        gen_random_uuid(), p_org_id, v_web_id, v_issue_id, v_now - interval '3 hours',
        'production', 'web@2.14.0', 'javascript',
        'browser', '129.0', 'Firefox', 'Windows',
        'usr_2d9e4f7a', 'bob@acme-corp.com',
        $p1payload${"platform":"javascript","level":"error","environment":"production","release":"web@2.14.0","transaction":"/checkout/payment","tags":{"feature":"payments","provider":"stripe"},"user":{"id":"usr_2d9e4f7a","email":"bob@acme-corp.com","username":"bob"},"contexts":{"browser":{"name":"Firefox","version":"129.0"},"os":{"name":"Windows","version":"11"},"runtime":{"name":"browser","version":"129.0"}},"exception":{"values":[{"type":"Error","value":"Payment failed: card declined (500)","stacktrace":{"frames":[{"filename":"webpack:///./node_modules/axios/lib/core/Axios.js","function":"Axios.request","lineno":45,"colno":21,"in_app":false},{"filename":"webpack:///./src/lib/api.ts","function":"post","lineno":28,"colno":10,"in_app":true,"context_line":"  return axios.post<T>(path, body, config);"},{"filename":"webpack:///./src/services/payments.ts","function":"chargeCard","lineno":61,"colno":18,"in_app":true,"context_line":"  const res = await post<ChargeResponse>('/api/payments/charge', payload);","pre_context":["export async function chargeCard(payload: ChargePayload) {","  const token = getAuthToken();"],"post_context":["  return res.data;","}"]},{"filename":"webpack:///./src/components/PaymentForm.tsx","function":"submitPayment","lineno":103,"colno":11,"in_app":true,"context_line":"    await chargeCard({ amount, currency, cardToken });"}]}}]},"breadcrumbs":{"values":[{"timestamp":1726215000.0,"category":"navigation","level":"info","message":"Navigated to /checkout/payment"},{"timestamp":1726215002.1,"category":"console","level":"info","message":"Initializing Stripe Elements"},{"timestamp":1726215005.4,"category":"ui.input","level":"info","message":"card number entered","data":{"field":"cardNumber"}},{"timestamp":1726215008.7,"category":"fetch","level":"info","message":"POST /api/payments/charge","data":{"method":"POST","url":"/api/payments/charge","status_code":500,"request_headers":{"Authorization":"Bearer sk_live_fixture_scrub_example_key"}}},{"timestamp":1726215008.9,"category":"console","level":"error","message":"Payment failed: card declined (500)"}]}}$p1payload$::jsonb,
        $p1frames$[{"filename":"webpack:///./node_modules/axios/lib/core/Axios.js","function":"Axios.request","lineno":45,"colno":21,"in_app":false},{"filename":"webpack:///./src/lib/api.ts","function":"post","lineno":28,"colno":10,"in_app":true,"context_line":"  return axios.post<T>(path, body, config);"},{"filename":"webpack:///./src/services/payments.ts","function":"chargeCard","lineno":61,"colno":18,"in_app":true,"context_line":"  const res = await post<ChargeResponse>('/api/payments/charge', payload);","pre_context":["export async function chargeCard(payload: ChargePayload) {","  const token = getAuthToken();"],"post_context":["  return res.data;","}"]},{"filename":"webpack:///./src/components/PaymentForm.tsx","function":"submitPayment","lineno":103,"colno":11,"in_app":true,"context_line":"    await chargeCard({ amount, currency, cardToken });"}]$p1frames$::jsonb,
        $p1crumbs$[{"timestamp":1726215000.0,"category":"navigation","level":"info","message":"Navigated to /checkout/payment"},{"timestamp":1726215002.1,"category":"console","level":"info","message":"Initializing Stripe Elements"},{"timestamp":1726215005.4,"category":"ui.input","level":"info","message":"card number entered","data":{"field":"cardNumber"}},{"timestamp":1726215008.7,"category":"fetch","level":"info","message":"POST /api/payments/charge","data":{"method":"POST","url":"/api/payments/charge","status_code":500,"request_headers":{"Authorization":"Bearer sk_live_fixture_scrub_example_key"}}},{"timestamp":1726215008.9,"category":"console","level":"error","message":"Payment failed: card declined (500)"}]$p1crumbs$::jsonb
    );

    v_issue_id := gen_random_uuid();
    INSERT INTO issues (
        id, org_id, project_id, fingerprint, title, status, level,
        first_seen_at, last_seen_at, event_count, unique_user_count,
        environment, release
    ) VALUES (
        v_issue_id, p_org_id, v_web_id, 'demo-web-hydration',
        'Error: Hydration failed: text content did not match server HTML',
        'unresolved', 'error', v_now - interval '1 day', v_now - interval '6 hours',
        2, 1, 'production', 'web@2.13.2'
    );
    INSERT INTO events (
        id, org_id, project_id, issue_id, occurred_at, environment, release,
        platform, runtime_name, runtime_version, browser_name, os_name,
        user_id, user_email, payload_json, stack_frames, breadcrumbs
    ) VALUES (
        gen_random_uuid(), p_org_id, v_web_id, v_issue_id, v_now - interval '6 hours',
        'production', 'web@2.13.2', 'javascript',
        'browser', '17.5', 'Safari', 'macOS',
        'usr_hydration_01', 'carol@acme-corp.com',
        $p2payload${"platform":"javascript","level":"error","environment":"production","release":"web@2.13.2","transaction":"/dashboard","tags":{"feature":"dashboard","framework":"react"},"user":{"id":"usr_hydration_01","email":"carol@acme-corp.com","username":"carol"},"contexts":{"browser":{"name":"Safari","version":"17.5"},"os":{"name":"macOS","version":"14.6"},"runtime":{"name":"browser","version":"17.5"}},"exception":{"values":[{"type":"Error","value":"Hydration failed: text content did not match server HTML","stacktrace":{"frames":[{"filename":"webpack:///./node_modules/react-dom/cjs/react-dom.production.min.js","function":"throwOnHydrationMismatch","lineno":12501,"colno":9,"in_app":false},{"filename":"webpack:///./src/components/StatCard.tsx","function":"StatCard","lineno":22,"colno":11,"in_app":true,"context_line":"      <span>{formatCount(count)}</span>","pre_context":["export function StatCard({ count }: { count: number }) {","  return ("],"post_context":["    </div>","  );"]},{"filename":"webpack:///./src/pages/DashboardPage.tsx","function":"DashboardPage","lineno":48,"colno":7,"in_app":true,"context_line":"      <StatCard count={stats.unresolved} />","pre_context":["  return (","    <section>"],"post_context":["    </section>","  );"]}]}}]},"breadcrumbs":{"values":[{"timestamp":1726214400.0,"type":"navigation","category":"navigation","level":"info","message":"Navigated to /dashboard"},{"timestamp":1726214401.2,"type":"default","category":"console","level":"warning","message":"Warning: Text content did not match. Server: \"12\" Client: \"847\""},{"timestamp":1726214401.5,"type":"default","category":"console","level":"error","message":"Error: Hydration failed: text content did not match server HTML"}]}}$p2payload$::jsonb,
        $p2frames$[{"filename":"webpack:///./node_modules/react-dom/cjs/react-dom.production.min.js","function":"throwOnHydrationMismatch","lineno":12501,"colno":9,"in_app":false},{"filename":"webpack:///./src/components/StatCard.tsx","function":"StatCard","lineno":22,"colno":11,"in_app":true,"context_line":"      <span>{formatCount(count)}</span>","pre_context":["export function StatCard({ count }: { count: number }) {","  return ("],"post_context":["    </div>","  );"]},{"filename":"webpack:///./src/pages/DashboardPage.tsx","function":"DashboardPage","lineno":48,"colno":7,"in_app":true,"context_line":"      <StatCard count={stats.unresolved} />","pre_context":["  return (","    <section>"],"post_context":["    </section>","  );"]}]$p2frames$::jsonb,
        $p2crumbs$[{"timestamp":1726214400.0,"type":"navigation","category":"navigation","level":"info","message":"Navigated to /dashboard"},{"timestamp":1726214401.2,"type":"default","category":"console","level":"warning","message":"Warning: Text content did not match. Server: \"12\" Client: \"847\""},{"timestamp":1726214401.5,"type":"default","category":"console","level":"error","message":"Error: Hydration failed: text content did not match server HTML"}]$p2crumbs$::jsonb
    );

    v_issue_id := gen_random_uuid();
    INSERT INTO issues (
        id, org_id, project_id, fingerprint, title, status, level,
        first_seen_at, last_seen_at, event_count, unique_user_count,
        environment, release
    ) VALUES (
        v_issue_id, p_org_id, v_web_id, 'demo-web-auth-token',
        'Error: Session refresh failed: token expired',
        'regression', 'error', v_now - interval '10 days', v_now - interval '30 minutes',
        4, 2, 'production', 'web@2.14.0'
    );
    INSERT INTO events (
        id, org_id, project_id, issue_id, occurred_at, environment, release,
        platform, runtime_name, runtime_version, browser_name, os_name,
        user_id, user_email, payload_json, stack_frames, breadcrumbs
    ) VALUES (
        gen_random_uuid(), p_org_id, v_web_id, v_issue_id, v_now - interval '30 minutes',
        'production', 'web@2.14.0', 'javascript',
        'browser', '128.0.0.0', 'Chrome', 'Windows',
        'usr_auth_01', 'dave@acme-corp.com',
        $p3payload${"platform":"javascript","level":"error","environment":"production","release":"web@2.14.0","transaction":"/settings/account","tags":{"feature":"auth","endpoint":"/api/session/refresh"},"user":{"id":"usr_auth_01","email":"dave@acme-corp.com","username":"dave"},"contexts":{"browser":{"name":"Chrome","version":"128.0.0.0"},"os":{"name":"Windows","version":"11"},"runtime":{"name":"browser","version":"128.0.0.0"}},"exception":{"values":[{"type":"Error","value":"Session refresh failed: token expired","stacktrace":{"frames":[{"filename":"webpack:///./node_modules/axios/lib/core/Axios.js","function":"Axios.request","lineno":45,"colno":21,"in_app":false},{"filename":"webpack:///./src/lib/session.ts","function":"refreshSession","lineno":41,"colno":11,"in_app":true,"context_line":"  const res = await post<RefreshResponse>('/api/session/refresh');","pre_context":["export async function refreshSession() {","  const token = getStoredToken();"],"post_context":["  if (res.status === 401) throw new Error('token expired');","  return res.data;"]},{"filename":"webpack:///./src/hooks/useAuth.ts","function":"ensureSession","lineno":67,"colno":5,"in_app":true,"context_line":"    await refreshSession();","pre_context":["  const ensureSession = async () => {","    if (isExpired(token)) {"],"post_context":["    }","  };"]}]}}]},"breadcrumbs":{"values":[{"timestamp":1726214300.0,"type":"navigation","category":"navigation","level":"info","message":"Navigated to /settings/account"},{"timestamp":1726214302.1,"type":"http","category":"fetch","level":"info","message":"POST /api/session/refresh","data":{"method":"POST","url":"/api/session/refresh","status_code":401}},{"timestamp":1726214302.2,"type":"default","category":"console","level":"error","message":"Error: Session refresh failed: token expired"}]}}$p3payload$::jsonb,
        $p3frames$[{"filename":"webpack:///./node_modules/axios/lib/core/Axios.js","function":"Axios.request","lineno":45,"colno":21,"in_app":false},{"filename":"webpack:///./src/lib/session.ts","function":"refreshSession","lineno":41,"colno":11,"in_app":true,"context_line":"  const res = await post<RefreshResponse>('/api/session/refresh');","pre_context":["export async function refreshSession() {","  const token = getStoredToken();"],"post_context":["  if (res.status === 401) throw new Error('token expired');","  return res.data;"]},{"filename":"webpack:///./src/hooks/useAuth.ts","function":"ensureSession","lineno":67,"colno":5,"in_app":true,"context_line":"    await refreshSession();","pre_context":["  const ensureSession = async () => {","    if (isExpired(token)) {"],"post_context":["    }","  };"]}]$p3frames$::jsonb,
        $p3crumbs$[{"timestamp":1726214300.0,"type":"navigation","category":"navigation","level":"info","message":"Navigated to /settings/account"},{"timestamp":1726214302.1,"type":"http","category":"fetch","level":"info","message":"POST /api/session/refresh","data":{"method":"POST","url":"/api/session/refresh","status_code":401}},{"timestamp":1726214302.2,"type":"default","category":"console","level":"error","message":"Error: Session refresh failed: token expired"}]$p3crumbs$::jsonb
    );

    v_issue_id := gen_random_uuid();
    INSERT INTO issues (
        id, org_id, project_id, fingerprint, title, status, level,
        first_seen_at, last_seen_at, event_count, unique_user_count,
        environment, release
    ) VALUES (
        v_issue_id, p_org_id, v_api_id, 'demo-api-unhandled-rejection',
        'Error: connect ECONNREFUSED 10.0.4.12:5432',
        'unresolved', 'error', v_now - interval '3 days', v_now - interval '2 hours',
        6, 1, 'production', 'api@1.8.0'
    );
    INSERT INTO events (
        id, org_id, project_id, issue_id, occurred_at, environment, release,
        platform, runtime_name, runtime_version, browser_name, os_name,
        user_id, user_email, payload_json, stack_frames, breadcrumbs
    ) VALUES (
        gen_random_uuid(), p_org_id, v_api_id, v_issue_id, v_now - interval '2 hours',
        'production', 'api@1.8.0', 'node',
        'node', '20.11.0', NULL, 'Linux',
        'svc_orders', 'orders@acme-corp.com',
        $p4payload${"platform":"node","level":"error","environment":"production","release":"api@1.8.0","transaction":"POST /api/orders","tags":{"service":"orders-api","region":"eu-west-1"},"user":{"id":"svc_orders","email":"orders@acme-corp.com"},"contexts":{"runtime":{"name":"node","version":"20.11.0"},"os":{"name":"Linux","version":"6.1.0"}},"exception":{"values":[{"type":"Error","value":"connect ECONNREFUSED 10.0.4.12:5432","stacktrace":{"frames":[{"filename":"node:net","function":"TCPConnectWrap.afterConnect","lineno":1595,"colno":16,"in_app":false},{"filename":"node:internal/process/task_queues","function":"process.processTicksAndRejections","lineno":95,"colno":5,"in_app":false},{"filename":"/app/node_modules/pg-pool/index.js","function":"Pool.connect","lineno":45,"colno":11,"in_app":false},{"filename":"/app/src/db/pool.ts","function":"getClient","lineno":22,"colno":10,"in_app":true,"context_line":"  return pool.connect();"},{"filename":"/app/src/routes/orders.ts","function":"createOrder","lineno":48,"colno":20,"in_app":true,"context_line":"  const client = await getClient();","pre_context":["export async function createOrder(req: Request) {","  const payload = req.body;"],"post_context":["  await client.query('BEGIN');","  try {"]},{"filename":"/app/src/routes/orders.ts","function":"handler","lineno":12,"colno":5,"in_app":true,"context_line":"    await createOrder(req);"}]}}]},"breadcrumbs":{"values":[{"timestamp":1726215600.0,"category":"console","level":"info","message":"orders-api listening on :3000"},{"timestamp":1726215605.2,"category":"http","level":"info","message":"POST /api/orders","data":{"method":"POST","url":"/api/orders","status_code":0}},{"timestamp":1726215605.3,"category":"console","level":"warning","message":"password=SuperSecretDbPass123 connecting to replica"}]}}$p4payload$::jsonb,
        $p4frames$[{"filename":"node:net","function":"TCPConnectWrap.afterConnect","lineno":1595,"colno":16,"in_app":false},{"filename":"node:internal/process/task_queues","function":"process.processTicksAndRejections","lineno":95,"colno":5,"in_app":false},{"filename":"/app/node_modules/pg-pool/index.js","function":"Pool.connect","lineno":45,"colno":11,"in_app":false},{"filename":"/app/src/db/pool.ts","function":"getClient","lineno":22,"colno":10,"in_app":true,"context_line":"  return pool.connect();"},{"filename":"/app/src/routes/orders.ts","function":"createOrder","lineno":48,"colno":20,"in_app":true,"context_line":"  const client = await getClient();","pre_context":["export async function createOrder(req: Request) {","  const payload = req.body;"],"post_context":["  await client.query('BEGIN');","  try {"]},{"filename":"/app/src/routes/orders.ts","function":"handler","lineno":12,"colno":5,"in_app":true,"context_line":"    await createOrder(req);"}]$p4frames$::jsonb,
        $p4crumbs$[{"timestamp":1726215600.0,"category":"console","level":"info","message":"orders-api listening on :3000"},{"timestamp":1726215605.2,"category":"http","level":"info","message":"POST /api/orders","data":{"method":"POST","url":"/api/orders","status_code":0}},{"timestamp":1726215605.3,"category":"console","level":"warning","message":"password=SuperSecretDbPass123 connecting to replica"}]$p4crumbs$::jsonb
    );

    v_issue_id := gen_random_uuid();
    INSERT INTO issues (
        id, org_id, project_id, fingerprint, title, status, level,
        first_seen_at, last_seen_at, event_count, unique_user_count,
        environment, release
    ) VALUES (
        v_issue_id, p_org_id, v_api_id, 'demo-api-db-timeout',
        'OperationalError: database connection timed out',
        'unresolved', 'error', v_now - interval '4 days', v_now - interval '5 hours',
        2, 1, 'production', 'api@1.8.0'
    );
    INSERT INTO events (
        id, org_id, project_id, issue_id, occurred_at, environment, release,
        platform, runtime_name, runtime_version, browser_name, os_name,
        user_id, user_email, payload_json, stack_frames, breadcrumbs
    ) VALUES (
        gen_random_uuid(), p_org_id, v_api_id, v_issue_id, v_now - interval '5 hours',
        'production', 'api@1.8.0', 'python',
        'CPython', '3.12.1', NULL, 'Linux',
        'celery_worker_3', 'worker@acme-corp.com',
        $p5payload${"platform":"python","level":"error","environment":"production","release":"api@1.8.0","transaction":"tasks.sync_inventory","tags":{"celery_task":"sync_inventory","queue":"default"},"user":{"id":"celery_worker_3","email":"worker@acme-corp.com"},"contexts":{"runtime":{"name":"CPython","version":"3.12.1"},"os":{"name":"Linux","version":"6.1.0"}},"exception":{"values":[{"type":"OperationalError","value":"connection to server at \"db.internal\" (10.0.2.15), port 5432 failed: timeout expired","stacktrace":{"frames":[{"filename":"/app/.venv/lib/python3.12/site-packages/psycopg2/__init__.py","function":"connect","lineno":122,"in_app":false},{"filename":"/app/src/db/connection.py","function":"get_connection","lineno":31,"colno":12,"in_app":true,"context_line":"    return psycopg2.connect(dsn, connect_timeout=5)","pre_context":["def get_connection():","    dsn = settings.DATABASE_URL"],"post_context":["","def release_connection(conn):"]},{"filename":"/app/src/tasks/inventory.py","function":"sync_inventory","lineno":54,"in_app":true,"context_line":"    conn = get_connection()","pre_context":["@celery.task","def sync_inventory(sku_batch: list[str]):"],"post_context":["    cursor = conn.cursor()","    cursor.execute('SELECT sku, qty FROM inventory WHERE sku = ANY(%s)', (sku_batch,))"]},{"filename":"/app/.venv/lib/python3.12/site-packages/celery/app/trace.py","function":"TraceInfo.build","lineno":477,"in_app":false}]}}]},"breadcrumbs":{"values":[{"timestamp":1726216200.0,"category":"celery","level":"info","message":"Task tasks.sync_inventory received","data":{"task_id":"a1b2c3d4-e5f6-7890-abcd-ef1234567890"}},{"timestamp":1726216200.5,"category":"query","level":"info","message":"SELECT 1","data":{"db":"inventory","duration_ms":4}},{"timestamp":1726216205.1,"category":"query","level":"warning","message":"connection attempt 1 failed, retrying","data":{"host":"db.internal","port":5432}},{"timestamp":1726216210.2,"category":"query","level":"error","message":"connection to server at db.internal failed: timeout expired"}]}}$p5payload$::jsonb,
        $p5frames$[{"filename":"/app/.venv/lib/python3.12/site-packages/psycopg2/__init__.py","function":"connect","lineno":122,"in_app":false},{"filename":"/app/src/db/connection.py","function":"get_connection","lineno":31,"colno":12,"in_app":true,"context_line":"    return psycopg2.connect(dsn, connect_timeout=5)","pre_context":["def get_connection():","    dsn = settings.DATABASE_URL"],"post_context":["","def release_connection(conn):"]},{"filename":"/app/src/tasks/inventory.py","function":"sync_inventory","lineno":54,"in_app":true,"context_line":"    conn = get_connection()","pre_context":["@celery.task","def sync_inventory(sku_batch: list[str]):"],"post_context":["    cursor = conn.cursor()","    cursor.execute('SELECT sku, qty FROM inventory WHERE sku = ANY(%s)', (sku_batch,))"]},{"filename":"/app/.venv/lib/python3.12/site-packages/celery/app/trace.py","function":"TraceInfo.build","lineno":477,"in_app":false}]$p5frames$::jsonb,
        $p5crumbs$[{"timestamp":1726216200.0,"category":"celery","level":"info","message":"Task tasks.sync_inventory received","data":{"task_id":"a1b2c3d4-e5f6-7890-abcd-ef1234567890"}},{"timestamp":1726216200.5,"category":"query","level":"info","message":"SELECT 1","data":{"db":"inventory","duration_ms":4}},{"timestamp":1726216205.1,"category":"query","level":"warning","message":"connection attempt 1 failed, retrying","data":{"host":"db.internal","port":5432}},{"timestamp":1726216210.2,"category":"query","level":"error","message":"connection to server at db.internal failed: timeout expired"}]$p5crumbs$::jsonb
    );

    v_issue_id := gen_random_uuid();
    INSERT INTO issues (
        id, org_id, project_id, fingerprint, title, status, level,
        first_seen_at, last_seen_at, event_count, unique_user_count,
        environment, release
    ) VALUES (
        v_issue_id, p_org_id, v_api_id, 'demo-api-nil-pointer',
        'runtime error: invalid memory address or nil pointer dereference',
        'unresolved', 'fatal', v_now - interval '6 days', v_now - interval '8 hours',
        1, 1, 'production', 'api@1.7.4'
    );
    INSERT INTO events (
        id, org_id, project_id, issue_id, occurred_at, environment, release,
        platform, runtime_name, runtime_version, browser_name, os_name,
        user_id, user_email, payload_json, stack_frames, breadcrumbs
    ) VALUES (
        gen_random_uuid(), p_org_id, v_api_id, v_issue_id, v_now - interval '8 hours',
        'production', 'api@1.7.4', 'go',
        'go', 'go1.22.0', NULL, 'linux',
        'api_key_7xk2', 'integrations@acme-corp.com',
        $p6payload${"platform":"go","level":"fatal","environment":"production","release":"api@1.7.4","transaction":"GET /v1/invoices/{id}","tags":{"service":"gateway","handler":"GetInvoice"},"user":{"id":"api_key_7xk2","email":"integrations@acme-corp.com"},"contexts":{"runtime":{"name":"go","version":"go1.22.0"},"os":{"name":"linux"}},"exception":{"values":[{"type":"runtime.errorString","value":"runtime error: invalid memory address or nil pointer dereference","stacktrace":{"frames":[{"filename":"/go/pkg/mod/github.com/gin-gonic/gin@v1.9.1/context.go","function":"(*Context).Next","lineno":174,"in_app":false},{"filename":"/app/internal/handlers/invoices.go","function":"GetInvoice","lineno":67,"in_app":true,"context_line":"\tlineItems := invoice.LineItems","pre_context":["func GetInvoice(c *gin.Context) {","\tinvoice, err := store.FindInvoice(c.Param(\"id\"))"],"post_context":["\tfor _, item := range lineItems {","\t\ttotal += item.Amount"]},{"filename":"/app/internal/router/router.go","function":"SetupRoutes.GetInvoice.func3","lineno":41,"in_app":true,"context_line":"\t\tGetInvoice(c)"}]}}]},"breadcrumbs":{"values":[{"timestamp":1726217400.0,"category":"http","level":"info","message":"GET /v1/invoices/inv_9f2a","data":{"method":"GET","url":"/v1/invoices/inv_9f2a","status_code":0}},{"timestamp":1726217400.1,"category":"query","level":"info","message":"SELECT * FROM invoices WHERE id = $1","data":{"duration_ms":3,"rows":0}}]}}$p6payload$::jsonb,
        $p6frames$[{"filename":"/go/pkg/mod/github.com/gin-gonic/gin@v1.9.1/context.go","function":"(*Context).Next","lineno":174,"in_app":false},{"filename":"/app/internal/handlers/invoices.go","function":"GetInvoice","lineno":67,"in_app":true,"context_line":"\tlineItems := invoice.LineItems","pre_context":["func GetInvoice(c *gin.Context) {","\tinvoice, err := store.FindInvoice(c.Param(\"id\"))"],"post_context":["\tfor _, item := range lineItems {","\t\ttotal += item.Amount"]},{"filename":"/app/internal/router/router.go","function":"SetupRoutes.GetInvoice.func3","lineno":41,"in_app":true,"context_line":"\t\tGetInvoice(c)"}]$p6frames$::jsonb,
        $p6crumbs$[{"timestamp":1726217400.0,"category":"http","level":"info","message":"GET /v1/invoices/inv_9f2a","data":{"method":"GET","url":"/v1/invoices/inv_9f2a","status_code":0}},{"timestamp":1726217400.1,"category":"query","level":"info","message":"SELECT * FROM invoices WHERE id = $1","data":{"duration_ms":3,"rows":0}}]$p6crumbs$::jsonb
    );

    -- Skip setup wizard for demo projects.
    INSERT INTO user_setup_progress (
        user_id, org_id, project_id, project_named,
        dsn_copied_at, first_issue_seen_at, completed_at, updated_at
    ) VALUES
        (p_user_id, p_org_id, v_web_id, true, v_now, v_now, v_now, v_now),
        (p_user_id, p_org_id, v_api_id, true, v_now, v_now, v_now, v_now);
END;
$fn$;

REVOKE ALL ON FUNCTION auth_bootstrap_workspace(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_bootstrap_workspace(uuid, uuid, text) TO epure_app;
