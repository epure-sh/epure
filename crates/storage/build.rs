// Re-embed migrations whenever a file is added or changed (sqlx::migrate! is compile-time).
fn main() {
    println!("cargo:rerun-if-changed=migrations");
}
