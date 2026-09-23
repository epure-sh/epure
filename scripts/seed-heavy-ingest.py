#!/usr/bin/env python3
"""Ingest heavy, realistic seed events into a running Epure instance."""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
EVENTS_DIR = ROOT / "fixtures" / "seed" / "events"
HEAVY_DIR = EVENTS_DIR / "heavy"

ORG_ID = "11111111-1111-1111-1111-111111111111"

PROJECTS = {
    "web": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "public_key": "a1b2c3d4e5f6g7h8i9j0",
        "secret_key": "supersecretdevkey",
    },
    "api": {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "public_key": "b2c3d4e5f6g7h8i9j0k1",
        "secret_key": "supersecretdevkey",
    },
    "mobile": {
        "id": "770e8400-e29b-41d4-a716-446655440002",
        "public_key": "c3d4e5f6g7h8i9j0k1l2",
        "secret_key": "supersecretdevkey",
    },
}

DEV_EMAIL = os.environ.get("SEED_EMAIL", "")
DEV_PASSWORD = os.environ.get("SEED_PASSWORD", "")


def frame(
    filename: str,
    function: str,
    lineno: int,
    in_app: bool = True,
    context_line: str | None = None,
) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "filename": filename,
        "function": function,
        "lineno": lineno,
        "colno": 1,
        "in_app": in_app,
    }
    if context_line:
        entry["context_line"] = context_line
        entry["pre_context"] = [f"// {function}()"]
        entry["post_context"] = ["}"]
    return entry


def browser_payload(
    *,
    slug: str,
    error_type: str,
    message: str,
    transaction: str,
    release: str,
    environment: str,
    filename: str,
    function: str,
    lineno: int,
    feature: str,
    count: int = 1,
    level: str = "error",
    seed_status: str | None = None,
    seed_age_days: int | None = None,
    seed_merge_into: str | None = None,
    seed_snooze: str | None = None,
    regression: dict[str, str] | None = None,
    feedback: bool = False,
) -> dict[str, Any]:
    tags: dict[str, str] = {"feature": feature, "seed_slug": slug}
    if seed_status:
        tags["seed_status"] = seed_status
    if seed_age_days is not None:
        tags["seed_age_days"] = str(seed_age_days)
    if seed_merge_into:
        tags["seed_merge_into"] = seed_merge_into
    if seed_snooze:
        tags["seed_snooze"] = seed_snooze
    if regression:
        tags["seed_regression"] = "true"
    if feedback:
        tags["seed_feedback"] = "true"

    return {
        "slug": slug,
        "project": "web",
        "count": count,
        "regression": regression,
        "payload": {
            "platform": "javascript",
            "level": level,
            "environment": environment,
            "release": release,
            "transaction": transaction,
            "tags": tags,
            "user": {
                "id": "usr_placeholder",
                "email": "user@acme-corp.com",
                "username": "user",
            },
            "contexts": {
                "browser": {"name": "Chrome", "version": "128.0.0.0"},
                "os": {"name": "macOS", "version": "14.6"},
                "runtime": {"name": "browser", "version": "128.0.0.0"},
            },
            "request": {
                "url": f"https://app.acme-corp.com{transaction}",
                "method": "GET",
            },
            "exception": {
                "values": [
                    {
                        "type": error_type,
                        "value": message,
                        "stacktrace": {
                            "frames": [
                                frame(
                                    "webpack:///./node_modules/react-dom/cjs/react-dom.production.min.js",
                                    "invokeGuardedCallback",
                                    4213,
                                    in_app=False,
                                ),
                                frame(
                                    f"webpack:///./src/{filename}",
                                    function,
                                    lineno,
                                    context_line=f"  // {message[:60]}",
                                ),
                            ]
                        },
                    }
                ]
            },
            "breadcrumbs": {
                "values": [
                    {
                        "timestamp": 1726214400.0,
                        "type": "navigation",
                        "category": "navigation",
                        "level": "info",
                        "message": f"Navigated to {transaction}",
                    },
                    {
                        "timestamp": 1726214402.0,
                        "type": "http",
                        "category": "fetch",
                        "level": "info",
                        "message": f"GET {transaction}",
                        "data": {"status_code": 200},
                    },
                    {
                        "timestamp": 1726214404.0,
                        "type": "default",
                        "category": "console",
                        "level": "error",
                        "message": f"{error_type}: {message}",
                    },
                ]
            },
        },
    }


def server_payload(
    *,
    slug: str,
    project: str,
    platform: str,
    error_type: str,
    message: str,
    transaction: str,
    release: str,
    environment: str,
    filename: str,
    function: str,
    lineno: int,
    service: str,
    count: int = 1,
    level: str = "error",
    seed_status: str | None = None,
    seed_age_days: int | None = None,
    seed_merge_into: str | None = None,
    regression: dict[str, str] | None = None,
) -> dict[str, Any]:
    tags: dict[str, str] = {"service": service, "seed_slug": slug}
    if seed_status:
        tags["seed_status"] = seed_status
    if seed_age_days is not None:
        tags["seed_age_days"] = str(seed_age_days)
    if seed_merge_into:
        tags["seed_merge_into"] = seed_merge_into
    if regression:
        tags["seed_regression"] = "true"

    runtime = {
        "node": ("node", "20.11.0"),
        "python": ("CPython", "3.12.2"),
        "go": ("go", "go1.22.0"),
    }[platform]

    file_prefix = {
        "node": "/app/src/",
        "python": "/app/",
        "go": "/app/internal/",
    }[platform]

    return {
        "slug": slug,
        "project": project,
        "count": count,
        "regression": regression,
        "payload": {
            "platform": platform,
            "level": level,
            "environment": environment,
            "release": release,
            "transaction": transaction,
            "tags": tags,
            "user": {"id": f"svc_{service}", "email": f"{service}@acme-corp.com"},
            "contexts": {
                "runtime": {"name": runtime[0], "version": runtime[1]},
                "os": {"name": "linux"},
            },
            "exception": {
                "values": [
                    {
                        "type": error_type,
                        "value": message,
                        "stacktrace": {
                            "frames": [
                                frame(
                                    f"{file_prefix}{filename}",
                                    function,
                                    lineno,
                                    context_line=f"    raise {error_type}('{message[:40]}')",
                                )
                            ]
                        },
                    }
                ]
            },
            "breadcrumbs": {
                "values": [
                    {
                        "timestamp": 1726214400.0,
                        "type": "default",
                        "category": "log",
                        "level": "info",
                        "message": f"{transaction} started",
                    }
                ]
            },
        },
    }


def mobile_payload(
    *,
    slug: str,
    error_type: str,
    message: str,
    screen: str,
    release: str,
    environment: str,
    filename: str,
    function: str,
    lineno: int,
    feature: str,
    count: int = 1,
    seed_status: str | None = None,
    seed_age_days: int | None = None,
    seed_snooze: str | None = None,
) -> dict[str, Any]:
    tags: dict[str, str] = {"feature": feature, "seed_slug": slug}
    if seed_status:
        tags["seed_status"] = seed_status
    if seed_age_days is not None:
        tags["seed_age_days"] = str(seed_age_days)
    if seed_snooze:
        tags["seed_snooze"] = seed_snooze

    return {
        "slug": slug,
        "project": "mobile",
        "count": count,
        "regression": None,
        "payload": {
            "platform": "javascript",
            "level": "error",
            "environment": environment,
            "release": release,
            "transaction": screen,
            "tags": tags,
            "user": {
                "id": "mobile_user_placeholder",
                "email": "mobile@acme-corp.com",
            },
            "contexts": {
                "device": {"family": "iPhone", "model": "iPhone 15 Pro"},
                "os": {"name": "iOS", "version": "17.5"},
                "runtime": {"name": "react-native", "version": "0.74.0"},
            },
            "exception": {
                "values": [
                    {
                        "type": error_type,
                        "value": message,
                        "stacktrace": {
                            "frames": [
                                frame(
                                    f"app:///{filename}",
                                    function,
                                    lineno,
                                    context_line=f"  // {message[:50]}",
                                )
                            ]
                        },
                    }
                ]
            },
            "breadcrumbs": {
                "values": [
                    {
                        "timestamp": 1726214400.0,
                        "type": "navigation",
                        "category": "navigation",
                        "level": "info",
                        "message": f"Screen: {screen}",
                    }
                ]
            },
        },
    }


# Story-driven catalog: checkout spike after web@2.15.0, auth cluster, payment regression.
CATALOG: list[dict[str, Any]] = [
    # --- Acme Web: checkout / payments narrative ---
    browser_payload(
        slug="browser-checkout-typeerror",
        error_type="TypeError",
        message="Cannot read properties of undefined (reading 'price')",
        transaction="/checkout",
        release="web@2.15.0",
        environment="production",
        filename="hooks/useCart.ts",
        function="calculateTotal",
        lineno=34,
        feature="checkout",
        count=180,
        seed_age_days=2,
        feedback=True,
    ),
    browser_payload(
        slug="browser-payment-api-failed",
        error_type="Error",
        message="Payment failed: card declined (500)",
        transaction="/checkout/payment",
        release="web@2.15.0",
        environment="production",
        filename="services/payments.ts",
        function="chargeCard",
        lineno=61,
        feature="payments",
        count=95,
        seed_age_days=1,
        feedback=True,
    ),
    browser_payload(
        slug="browser-payment-timeout",
        error_type="Error",
        message="Payment gateway timeout after 30000ms",
        transaction="/checkout/payment",
        release="web@2.15.0",
        environment="production",
        filename="services/payments.ts",
        function="waitForConfirmation",
        lineno=88,
        feature="payments",
        count=42,
        seed_age_days=1,
    ),
    browser_payload(
        slug="browser-stripe-load-failed",
        error_type="Error",
        message="Failed to load Stripe.js: net::ERR_BLOCKED_BY_CLIENT",
        transaction="/checkout",
        release="web@2.15.0",
        environment="production",
        filename="components/StripeProvider.tsx",
        function="loadStripe",
        lineno=19,
        feature="payments",
        count=28,
    ),
    browser_payload(
        slug="browser-cart-sync-failed",
        error_type="Error",
        message="Cart sync failed: optimistic lock conflict",
        transaction="/cart",
        release="web@2.14.0",
        environment="production",
        filename="hooks/useCart.ts",
        function="syncCart",
        lineno=72,
        feature="checkout",
        count=18,
        seed_age_days=5,
    ),
    browser_payload(
        slug="browser-coupon-invalid",
        error_type="Error",
        message="Coupon SAVE20 is not valid for this cart",
        transaction="/checkout",
        release="web@2.15.0",
        environment="production",
        filename="components/CouponField.tsx",
        function="applyCoupon",
        lineno=44,
        feature="checkout",
        count=12,
    ),
    browser_payload(
        slug="react-hydration-mismatch",
        error_type="Error",
        message="Hydration failed: text content did not match server HTML",
        transaction="/dashboard",
        release="web@2.15.0",
        environment="production",
        filename="components/StatCard.tsx",
        function="StatCard",
        lineno=22,
        feature="dashboard",
        count=38,
        seed_age_days=1,
        regression={"resolve_release": "web@2.14.0", "recur_release": "web@2.15.0"},
    ),
    browser_payload(
        slug="auth-token-expired",
        error_type="Error",
        message="Session refresh failed: token expired",
        transaction="/settings/account",
        release="web@2.15.0",
        environment="production",
        filename="lib/session.ts",
        function="refreshSession",
        lineno=41,
        feature="auth",
        count=67,
        seed_age_days=3,
        seed_snooze="until_count:100",
    ),
    browser_payload(
        slug="auth-mfa-required",
        error_type="Error",
        message="MFA challenge required but device not enrolled",
        transaction="/login",
        release="web@2.15.0",
        environment="production",
        filename="hooks/useAuth.ts",
        function="completeLogin",
        lineno=93,
        feature="auth",
        count=24,
        seed_age_days=4,
    ),
    browser_payload(
        slug="auth-oauth-state-mismatch",
        error_type="Error",
        message="OAuth state parameter mismatch",
        transaction="/auth/callback",
        release="web@2.14.0",
        environment="production",
        filename="lib/oauth.ts",
        function="verifyState",
        lineno=31,
        feature="auth",
        count=9,
        seed_age_days=10,
    ),
    browser_payload(
        slug="staging-feature-flag",
        error_type="Warning",
        message="Feature flag checkout_v2 enabled without rollout cohort",
        transaction="/checkout",
        release="web@2.15.0-rc.1",
        environment="staging",
        filename="lib/featureFlags.ts",
        function="assertRollout",
        lineno=55,
        feature="flags",
        count=6,
        level="warning",
        seed_age_days=2,
    ),
    browser_payload(
        slug="dashboard-chart-render",
        error_type="TypeError",
        message="Cannot read properties of null (reading 'map')",
        transaction="/dashboard",
        release="web@2.14.0",
        environment="production",
        filename="components/RevenueChart.tsx",
        function="RevenueChart",
        lineno=47,
        feature="dashboard",
        count=31,
        seed_age_days=7,
    ),
    browser_payload(
        slug="search-index-missing",
        error_type="Error",
        message="Search index not ready: alias products_v3 missing",
        transaction="/search",
        release="web@2.14.0",
        environment="production",
        filename="hooks/useSearch.ts",
        function="runQuery",
        lineno=28,
        feature="search",
        count=14,
        seed_age_days=8,
    ),
    browser_payload(
        slug="product-image-404",
        error_type="Error",
        message="Product image CDN returned 404 for sku_WID-4421",
        transaction="/products/WID-4421",
        release="web@2.13.2",
        environment="production",
        filename="components/ProductGallery.tsx",
        function="loadImage",
        lineno=36,
        feature="catalog",
        count=22,
        seed_age_days=12,
        seed_status="resolved",
    ),
    browser_payload(
        slug="inventory-stale-cache",
        error_type="Error",
        message="Inventory count stale: cache TTL exceeded (sku_WID-4421)",
        transaction="/products/WID-4421",
        release="web@2.13.2",
        environment="production",
        filename="hooks/useInventory.ts",
        function="fetchStock",
        lineno=19,
        feature="catalog",
        count=8,
        seed_age_days=14,
        seed_merge_into="product-image-404",
    ),
    browser_payload(
        slug="legacy-banner-dismiss",
        error_type="Error",
        message="Legacy checkout banner dismissed without consent",
        transaction="/checkout",
        release="web@2.12.0",
        environment="production",
        filename="components/LegacyBanner.tsx",
        function="onDismiss",
        lineno=18,
        feature="checkout",
        count=3,
        seed_age_days=20,
        seed_status="ignored",
    ),
    browser_payload(
        slug="cookie-consent-race",
        error_type="Error",
        message="Cookie consent modal race: analytics loaded before consent",
        transaction="/",
        release="web@2.12.0",
        environment="production",
        filename="components/CookieBanner.tsx",
        function="bootstrapAnalytics",
        lineno=27,
        feature="compliance",
        count=2,
        seed_age_days=25,
        seed_status="ignored",
    ),
    browser_payload(
        slug="websocket-reconnect-loop",
        error_type="Error",
        message="WebSocket reconnect loop exceeded max attempts (12)",
        transaction="/notifications",
        release="web@2.14.0",
        environment="production",
        filename="lib/realtime.ts",
        function="connect",
        lineno=102,
        feature="realtime",
        count=16,
        seed_age_days=6,
    ),
    browser_payload(
        slug="i18n-missing-key",
        error_type="Error",
        message="Missing translation key: checkout.shipping.estimated_arrival",
        transaction="/checkout/shipping",
        release="web@2.15.0",
        environment="production",
        filename="lib/i18n.ts",
        function="t",
        lineno=14,
        feature="i18n",
        count=7,
        seed_age_days=3,
    ),
    browser_payload(
        slug="form-validation-zod",
        error_type="ZodError",
        message="Invalid email at path: user.email",
        transaction="/signup",
        release="web@2.14.0",
        environment="production",
        filename="schemas/signup.ts",
        function="parseSignup",
        lineno=12,
        feature="auth",
        count=11,
        seed_age_days=9,
    ),
    browser_payload(
        slug="local-dev-hmr",
        error_type="Error",
        message="Vite HMR websocket disconnected",
        transaction="/",
        release="web@2.15.0",
        environment="local",
        filename="vite/client",
        function="handleDisconnect",
        lineno=88,
        feature="dev",
        count=4,
        seed_age_days=0,
    ),
    browser_payload(
        slug="ab-test-assignment-failed",
        error_type="Error",
        message="A/B assignment failed: experiment checkout_cta_v3 closed",
        transaction="/",
        release="web@2.14.0",
        environment="production",
        filename="lib/experiments.ts",
        function="assignVariant",
        lineno=33,
        feature="experiments",
        count=5,
        seed_age_days=11,
    ),
    browser_payload(
        slug="analytics-blocked",
        error_type="Error",
        message="Analytics beacon blocked by content blocker",
        transaction="/",
        release="web@2.13.0",
        environment="production",
        filename="lib/analytics.ts",
        function="trackPage",
        lineno=21,
        feature="analytics",
        count=19,
        seed_age_days=15,
        seed_status="resolved",
    ),
    browser_payload(
        slug="pdf-invoice-render",
        error_type="Error",
        message="PDF render failed: font Inter-Regular not embedded",
        transaction="/invoices/INV-2044",
        release="web@2.14.0",
        environment="production",
        filename="components/InvoicePdf.tsx",
        function="renderPdf",
        lineno=58,
        feature="billing",
        count=6,
        seed_age_days=13,
    ),
    browser_payload(
        slug="rate-limit-checkout",
        error_type="Error",
        message="Rate limit exceeded: 10 checkout attempts in 60s",
        transaction="/checkout",
        release="web@2.15.0",
        environment="production",
        filename="lib/rateLimit.ts",
        function="assertCheckoutLimit",
        lineno=17,
        feature="checkout",
        count=33,
        seed_age_days=1,
        seed_snooze="until_hours:24",
    ),
    browser_payload(
        slug="shipping-quote-unavailable",
        error_type="Error",
        message="Shipping quote unavailable for postal code 75001",
        transaction="/checkout/shipping",
        release="web@2.15.0",
        environment="production",
        filename="services/shipping.ts",
        function="fetchQuote",
        lineno=42,
        feature="checkout",
        count=15,
        seed_age_days=2,
    ),
    browser_payload(
        slug="tax-calc-mismatch",
        error_type="Error",
        message="Tax calculation mismatch: expected 12.40 got 11.90",
        transaction="/checkout/review",
        release="web@2.15.0",
        environment="production",
        filename="services/tax.ts",
        function="calculateTax",
        lineno=29,
        feature="checkout",
        count=21,
        seed_age_days=2,
    ),
    browser_payload(
        slug="wishlist-sync-failed",
        error_type="Error",
        message="Wishlist sync failed: 409 conflict on item sku_WID-9912",
        transaction="/wishlist",
        release="web@2.14.0",
        environment="production",
        filename="hooks/useWishlist.ts",
        function="syncWishlist",
        lineno=51,
        feature="catalog",
        count=8,
        seed_age_days=7,
    ),
    browser_payload(
        slug="admin-export-csv",
        error_type="Error",
        message="CSV export failed: row limit 50000 exceeded",
        transaction="/admin/orders/export",
        release="web@2.13.0",
        environment="production",
        filename="pages/admin/OrdersExport.tsx",
        function="exportCsv",
        lineno=74,
        feature="admin",
        count=4,
        seed_age_days=18,
        seed_status="resolved",
    ),
    # --- Acme API ---
    server_payload(
        slug="node-unhandled-rejection",
        project="api",
        platform="node",
        error_type="Error",
        message="connect ECONNREFUSED 10.0.4.12:5432",
        transaction="POST /api/orders",
        release="api@1.8.3",
        environment="production",
        filename="db/pool.ts",
        function="getConnection",
        lineno=44,
        service="orders-api",
        count=34,
        seed_age_days=4,
    ),
    server_payload(
        slug="python-database-timeout",
        project="api",
        platform="python",
        error_type="OperationalError",
        message="canceling statement due to statement timeout",
        transaction="workers/reconcile.py",
        release="api@1.8.2",
        environment="production",
        filename="workers/reconcile.py",
        function="run_reconcile",
        lineno=118,
        service="reconcile-worker",
        count=19,
        seed_age_days=6,
    ),
    server_payload(
        slug="go-nil-pointer",
        project="api",
        platform="go",
        error_type="runtime.errorString",
        message="runtime error: invalid memory address or nil pointer dereference",
        transaction="GET /v1/invoices/{id}",
        release="api@1.8.3",
        environment="production",
        filename="handlers/invoices.go",
        function="GetInvoice",
        lineno=67,
        service="gateway",
        count=12,
        seed_age_days=5,
        seed_status="resolved",
    ),
    server_payload(
        slug="node-stripe-webhook-sig",
        project="api",
        platform="node",
        error_type="Error",
        message="Stripe webhook signature verification failed",
        transaction="POST /webhooks/stripe",
        release="api@1.9.0",
        environment="production",
        filename="webhooks/stripe.ts",
        function="verifySignature",
        lineno=23,
        service="payments-api",
        count=27,
        seed_age_days=1,
        regression={"resolve_release": "api@1.8.3", "recur_release": "api@1.9.0"},
    ),
    server_payload(
        slug="python-celery-retry",
        project="api",
        platform="python",
        error_type="Retry",
        message="Email delivery failed: SMTP 421 Service not available",
        transaction="tasks/send_invoice_email",
        release="api@1.8.3",
        environment="production",
        filename="tasks/email.py",
        function="send_invoice_email",
        lineno=56,
        service="email-worker",
        count=14,
        seed_age_days=3,
    ),
    server_payload(
        slug="go-redis-timeout",
        project="api",
        platform="go",
        error_type="Error",
        message="redis: connection pool timeout",
        transaction="GET /v1/catalog/{id}",
        release="api@1.9.0",
        environment="production",
        filename="cache/redis.go",
        function="Get",
        lineno=38,
        service="catalog-api",
        count=21,
        seed_age_days=2,
    ),
    server_payload(
        slug="node-jwt-expired",
        project="api",
        platform="node",
        error_type="TokenExpiredError",
        message="jwt expired",
        transaction="GET /api/session",
        release="api@1.8.3",
        environment="production",
        filename="middleware/auth.ts",
        function="requireSession",
        lineno=31,
        service="auth-api",
        count=45,
        seed_age_days=2,
    ),
    server_payload(
        slug="python-pydantic-validation",
        project="api",
        platform="python",
        error_type="ValidationError",
        message="1 validation error for OrderCreate\nquantity\n  Input should be greater than 0",
        transaction="POST /v1/orders",
        release="api@1.9.0",
        environment="production",
        filename="schemas/order.py",
        function="validate_create",
        lineno=27,
        service="orders-api",
        count=9,
        seed_age_days=1,
    ),
    server_payload(
        slug="go-context-canceled",
        project="api",
        platform="go",
        error_type="context.Canceled",
        message="context canceled",
        transaction="GET /v1/search",
        release="api@1.8.2",
        environment="production",
        filename="handlers/search.go",
        function="Search",
        lineno=41,
        service="search-api",
        count=7,
        seed_age_days=8,
    ),
    server_payload(
        slug="node-kafka-lag",
        project="api",
        platform="node",
        error_type="Error",
        message="Consumer lag exceeded threshold: 120000 messages",
        transaction="consumers/order-events",
        release="api@1.8.3",
        environment="production",
        filename="consumers/orderEvents.ts",
        function="checkLag",
        lineno=62,
        service="events-consumer",
        count=6,
        seed_age_days=9,
    ),
    server_payload(
        slug="python-s3-access-denied",
        project="api",
        platform="python",
        error_type="ClientError",
        message="An error occurred (AccessDenied) when calling GetObject",
        transaction="workers/artifact_sync",
        release="api@1.8.2",
        environment="staging",
        filename="workers/artifact_sync.py",
        function="sync_release",
        lineno=84,
        service="release-worker",
        count=3,
        seed_age_days=4,
    ),
    server_payload(
        slug="go-rate-limit",
        project="api",
        platform="go",
        error_type="Error",
        message="rate limit exceeded for client 10.2.4.8",
        transaction="POST /v1/payments/charge",
        release="api@1.9.0",
        environment="production",
        filename="middleware/ratelimit.go",
        function="Allow",
        lineno=52,
        service="payments-api",
        count=38,
        seed_age_days=1,
    ),
    server_payload(
        slug="node-prisma-migration",
        project="api",
        platform="node",
        error_type="Error",
        message="P3009: migrate found failed migrations",
        transaction="deploy/migrate",
        release="api@1.8.2",
        environment="staging",
        filename="deploy/migrate.ts",
        function="runMigrations",
        lineno=18,
        service="deploy",
        count=2,
        seed_age_days=12,
        seed_status="ignored",
    ),
    server_payload(
        slug="python-openapi-schema",
        project="api",
        platform="python",
        error_type="Error",
        message="OpenAPI schema drift: missing field shipping_method",
        transaction="ci/openapi-check",
        release="api@1.9.0",
        environment="staging",
        filename="ci/openapi_check.py",
        function="assert_schema",
        lineno=33,
        service="ci",
        count=2,
        seed_age_days=1,
    ),
    server_payload(
        slug="go-invoice-pdf-nil",
        project="api",
        platform="go",
        error_type="Error",
        message="invoice PDF template not found for locale fr-FR",
        transaction="GET /v1/invoices/{id}/pdf",
        release="api@1.8.3",
        environment="production",
        filename="handlers/invoice_pdf.go",
        function="RenderPdf",
        lineno=29,
        service="billing-api",
        count=5,
        seed_age_days=7,
        seed_merge_into="go-nil-pointer",
    ),
    # --- Acme Mobile ---
    mobile_payload(
        slug="mobile-push-token-invalid",
        error_type="Error",
        message="APNs device token rejected: BadDeviceToken",
        screen="Settings/Notifications",
        release="mobile@3.2.0",
        environment="production",
        filename="services/push.ts",
        function="registerDevice",
        lineno=41,
        feature="notifications",
        count=16,
        seed_age_days=3,
    ),
    mobile_payload(
        slug="mobile-biometric-failed",
        error_type="Error",
        message="Biometric authentication failed: user canceled",
        screen="Login/Biometric",
        release="mobile@3.2.0",
        environment="production",
        filename="screens/Login.tsx",
        function="authenticateBiometric",
        lineno=67,
        feature="auth",
        count=22,
        seed_age_days=2,
        seed_snooze="until_users:50",
    ),
    mobile_payload(
        slug="mobile-deep-link-parse",
        error_type="Error",
        message="Deep link parse failed: missing orderId query param",
        screen="DeepLink/Handler",
        release="mobile@3.1.4",
        environment="production",
        filename="navigation/deepLink.ts",
        function="parseDeepLink",
        lineno=24,
        feature="navigation",
        count=9,
        seed_age_days=8,
    ),
    mobile_payload(
        slug="mobile-offline-cart",
        error_type="Error",
        message="Offline cart merge conflict: local revision 4 server 6",
        screen="Cart/Sync",
        release="mobile@3.2.0",
        environment="production",
        filename="store/cartSlice.ts",
        function="mergeOfflineCart",
        lineno=88,
        feature="checkout",
        count=31,
        seed_age_days=1,
    ),
    mobile_payload(
        slug="mobile-image-cache-miss",
        error_type="Error",
        message="Image cache eviction failed: disk quota exceeded",
        screen="Product/Detail",
        release="mobile@3.1.4",
        environment="production",
        filename="components/CachedImage.tsx",
        function="loadCached",
        lineno=35,
        feature="catalog",
        count=7,
        seed_age_days=10,
        seed_status="resolved",
    ),
    mobile_payload(
        slug="mobile-location-denied",
        error_type="Error",
        message="Location permission denied",
        screen="StoreLocator",
        release="mobile@3.2.0",
        environment="production",
        filename="hooks/useLocation.ts",
        function="requestPermission",
        lineno=19,
        feature="stores",
        count=13,
        seed_age_days=4,
    ),
    mobile_payload(
        slug="mobile-ota-bundle",
        error_type="Error",
        message="OTA bundle signature verification failed",
        screen="App/Startup",
        release="mobile@3.1.0",
        environment="production",
        filename="ota/loader.ts",
        function="verifyBundle",
        lineno=52,
        feature="ota",
        count=4,
        seed_age_days=20,
        seed_status="ignored",
    ),
    mobile_payload(
        slug="mobile-crash-js-thread",
        error_type="Error",
        message="Exception in HostFunction: Malformed calls from JS",
        screen="Checkout/Payment",
        release="mobile@3.2.0",
        environment="production",
        filename="screens/CheckoutPayment.tsx",
        function="submitPayment",
        lineno=102,
        feature="checkout",
        count=48,
        seed_age_days=1,
    ),
    mobile_payload(
        slug="mobile-analytics-sdk",
        error_type="Error",
        message="Analytics SDK init failed: missing write key",
        screen="App/Startup",
        release="mobile@3.1.4",
        environment="staging",
        filename="lib/analytics.ts",
        function="initAnalytics",
        lineno=14,
        feature="analytics",
        count=3,
        seed_age_days=6,
    ),
    mobile_payload(
        slug="mobile-secure-storage",
        error_type="Error",
        message="Keychain write failed: errSecInteractionNotAllowed",
        screen="Login/SaveSession",
        release="mobile@3.2.0",
        environment="production",
        filename="lib/secureStorage.ts",
        function="saveToken",
        lineno=27,
        feature="auth",
        count=11,
        seed_age_days=5,
    ),
]

# Reuse hand-authored fixtures for the headline issues (richer stacks).
EXISTING_FIXTURES = {
    "browser-checkout-typeerror": EVENTS_DIR / "browser-checkout-typeerror.json",
    "browser-payment-api-failed": EVENTS_DIR / "browser-payment-api-failed.json",
    "react-hydration-mismatch": EVENTS_DIR / "react-hydration-mismatch.json",
    "auth-token-expired": EVENTS_DIR / "auth-token-expired.json",
    "staging-feature-flag": EVENTS_DIR / "staging-feature-flag.json",
    "node-unhandled-rejection": EVENTS_DIR / "node-unhandled-rejection.json",
    "python-database-timeout": EVENTS_DIR / "python-database-timeout.json",
    "go-nil-pointer": EVENTS_DIR / "go-nil-pointer.json",
}


@dataclass
class HttpClient:
    base_url: str
    cookie: str | None = None

    def request(
        self,
        method: str,
        path: str,
        body: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> tuple[int, str]:
        data = None
        req_headers = dict(headers or {})
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            req_headers.setdefault("Content-Type", "application/json")
        if self.cookie:
            req_headers.setdefault("Cookie", self.cookie)

        req = urllib.request.Request(
            f"{self.base_url}{path}",
            data=data,
            method=method,
            headers=req_headers,
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                self._capture_cookies(resp.headers)
                return resp.status, resp.read().decode("utf-8")
        except urllib.error.HTTPError as err:
            self._capture_cookies(err.headers)
            return err.code, err.read().decode("utf-8")

    def _capture_cookies(self, headers: Any) -> None:
        if headers is None:
            return
        raw = headers.get_all("Set-Cookie") if hasattr(headers, "get_all") else None
        if not raw:
            return
        pairs = []
        for header in raw:
            pairs.append(header.split(";", 1)[0].strip())
        if pairs:
            self.cookie = "; ".join(pairs)


def write_fixtures() -> None:
    HEAVY_DIR.mkdir(parents=True, exist_ok=True)
    for entry in CATALOG:
        slug = entry["slug"]
        if slug in EXISTING_FIXTURES:
            continue
        path = HEAVY_DIR / f"{slug}.json"
        path.write_text(json.dumps(entry["payload"], indent=2) + "\n", encoding="utf-8")


def load_payload(entry: dict[str, Any]) -> dict[str, Any]:
    slug = entry["slug"]
    if slug in EXISTING_FIXTURES and EXISTING_FIXTURES[slug].exists():
        payload = json.loads(EXISTING_FIXTURES[slug].read_text(encoding="utf-8"))
        tags = payload.get("tags") or {}
        tags.update(entry["payload"].get("tags") or {})
        payload["tags"] = tags
        if entry.get("regression"):
            tags["seed_regression"] = "true"
        return payload
    return json.loads(json.dumps(entry["payload"]))


def patch_user(payload: dict[str, Any], index: int) -> dict[str, Any]:
    cloned = json.loads(json.dumps(payload))
    user = cloned.get("user") or {}
    user["id"] = f"usr_{cloned.get('tags', {}).get('seed_slug', 'event')}_{index:04d}"
    first_names = ["alice", "bob", "carol", "dave", "eve", "frank", "grace", "henry"]
    name = first_names[index % len(first_names)]
    user["email"] = f"{name}{index}@acme-corp.com"
    user["username"] = f"{name}{index}"
    cloned["user"] = user
    return cloned


def post_event(client: HttpClient, project_id: str, auth_header: str, payload: dict[str, Any]) -> None:
    status, body = client.request(
        "POST",
        f"/api/{project_id}/store/",
        payload,
        headers={"X-Sentry-Auth": auth_header},
    )
    if status not in (200, 202):
        raise RuntimeError(f"ingest failed HTTP {status}: {body[:200]}")


def login(client: HttpClient) -> bool:
    if not DEV_EMAIL or not DEV_PASSWORD:
        return False
    status, _ = client.request(
        "POST",
        "/api/v1/auth/login",
        {"email": DEV_EMAIL, "password": DEV_PASSWORD},
    )
    if status != 204:
        raise RuntimeError(f"login failed HTTP {status}")
    return True


def resolve_issue_sql(issue_id: str, resolved_in_release: str) -> None:
    import subprocess

    sql = (
        "UPDATE issues SET status = 'resolved', "
        f"resolved_in_release = '{resolved_in_release}' "
        f"WHERE id = '{issue_id}';"
    )

    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        result = subprocess.run(
            ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-c", sql],
            capture_output=True,
            text=True,
            check=False,
        )
    else:
        result = subprocess.run(
            [
                "docker",
                "compose",
                "exec",
                "-T",
                "postgres",
                "psql",
                "-U",
                "epure",
                "-d",
                "epure",
                "-v",
                "ON_ERROR_STOP=1",
                "-c",
                sql,
            ],
            capture_output=True,
            text=True,
            cwd=ROOT,
            check=False,
        )
    if result.returncode != 0:
        raise RuntimeError(
            f"resolve via SQL failed: {result.stderr.strip() or result.stdout.strip()}"
        )


def resolve_issue(client: HttpClient, issue_id: str, resolved_in_release: str) -> None:
    status, body = client.request(
        "PATCH",
        f"/api/v1/issues/{issue_id}",
        {"status": "resolved", "resolved_in_release": resolved_in_release},
    )
    if status != 200:
        raise RuntimeError(f"resolve failed HTTP {status}: {body[:200]}")


def issue_id_for_slug(project_id: str, slug: str) -> str | None:
    import subprocess

    sql = (
        "SELECT i.id FROM issues i "
        "JOIN events e ON e.issue_id = i.id "
        f"WHERE i.project_id = '{project_id}' "
        f"AND e.payload_json->'tags'->>'seed_slug' = '{slug}' "
        "LIMIT 1;"
    )

    def run_docker() -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                "docker",
                "compose",
                "exec",
                "-T",
                "postgres",
                "psql",
                "-U",
                "Epure",
                "-d",
                "Epure",
                "-tAc",
                sql,
            ],
            capture_output=True,
            text=True,
            cwd=ROOT,
            check=False,
        )

    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        try:
            result = subprocess.run(
                ["psql", database_url, "-tAc", sql],
                capture_output=True,
                text=True,
                check=False,
            )
        except FileNotFoundError:
            result = run_docker()
    else:
        result = run_docker()

    issue_id = result.stdout.strip()
    return issue_id or None


def ingest_catalog(base_url: str, write_only: bool = False) -> dict[str, int]:
    write_fixtures()
    if write_only:
        return {"fixtures_written": len(CATALOG)}

    client = HttpClient(base_url.rstrip("/"))
    posted = 0
    regression_slugs: list[tuple[str, str, dict[str, str]]] = []

    for entry in CATALOG:
        project = PROJECTS[entry["project"]]
        auth = (
            f"Sentry sentry_version=7, sentry_key={project['public_key']}, "
            f"sentry_secret={project['secret_key']}"
        )
        base_payload = load_payload(entry)
        count = int(entry["count"])
        regression = entry.get("regression")

        if regression:
            baseline = max(3, count // 8)
            for i in range(baseline):
                payload = patch_user(base_payload, i)
                payload["release"] = regression["resolve_release"]
                post_event(client, project["id"], auth, payload)
                posted += 1
            regression_slugs.append((entry["project"], entry["slug"], regression, count - baseline))
            continue

        for i in range(count):
            payload = patch_user(base_payload, i)
            post_event(client, project["id"], auth, payload)
            posted += 1
            if posted % 100 == 0:
                print(f"  posted {posted} events...", flush=True)

    # Allow worker flush before resolving regressions.
    time.sleep(1.5)
    logged_in = login(client)

    for project_key, slug, regression, recur_count in regression_slugs:
        project = PROJECTS[project_key]
        auth = (
            f"Sentry sentry_version=7, sentry_key={project['public_key']}, "
            f"sentry_secret={project['secret_key']}"
        )
        entry = next(item for item in CATALOG if item["slug"] == slug)
        base_payload = load_payload(entry)

        issue_id = issue_id_for_slug(project["id"], slug)
        if issue_id:
            if logged_in:
                resolve_issue(client, issue_id, regression["resolve_release"])
            else:
                resolve_issue_sql(issue_id, regression["resolve_release"])
            time.sleep(0.2)

        for i in range(recur_count):
            payload = patch_user(base_payload, 1000 + i)
            payload["release"] = regression["recur_release"]
            post_event(client, project["id"], auth, payload)
            posted += 1

    time.sleep(1.0)
    return {"events_posted": posted, "catalog_issues": len(CATALOG)}


def main() -> int:
    base_url = os.environ.get("EPURE_URL", "http://localhost:8080")
    write_only = "--write-fixtures" in sys.argv

    if not write_only:
        try:
            status, _ = HttpClient(base_url).request("GET", "/health")
        except OSError as err:
            print(f"error: Epure not reachable at {base_url}: {err}", file=sys.stderr)
            return 1
        if status != 200:
            print(f"error: health check failed HTTP {status}", file=sys.stderr)
            return 1

    print(f"heavy ingest starting ({'write fixtures only' if write_only else base_url})...")
    stats = ingest_catalog(base_url, write_only=write_only)
    print(json.dumps(stats, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
