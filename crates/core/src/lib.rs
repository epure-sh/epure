//! Core domain models, traits, and interface gates for Epure.
//!
//! Provides abstract trait boundaries (`TenancyGate`, `IngestionGate`, `AuthProvider`, `BillingProvider`)
//! decoupling the Apache 2.0 open-source engine from multi-tenant SaaS extensions.

pub mod traits;

pub use traits::*;
