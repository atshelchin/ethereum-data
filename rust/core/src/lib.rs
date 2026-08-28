//! Shared logic between the axum server (Docker) and the Cloudflare Worker.

pub const SERVICE_NAME: &str = "ethereum-data";
pub const REPO_URL: &str = "https://github.com/atshelchin/ethereum-data";
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// CORS headers applied to every response.
/// Names are lowercase so they can be used as `http::HeaderName::from_static`.
pub const CORS_HEADERS: [(&str, &str); 3] = [
    ("access-control-allow-origin", "*"),
    ("access-control-allow-methods", "GET, HEAD, OPTIONS"),
    ("access-control-allow-headers", "*"),
];

/// JSON body for `/api/health`.
pub fn health_body() -> String {
    format!(
        r#"{{"service":"{SERVICE_NAME}","version":"{VERSION}","repo":"{REPO_URL}","status":"ok"}}"#
    )
}

/// Cache-Control policy by URL path.
///
/// Must stay in sync with the `_headers` file at the repo root, which applies
/// the same policy on the Cloudflare Workers Static Assets deployment (where
/// static files never reach this code).
pub fn cache_control_for(path: &str) -> &'static str {
    if path.starts_with("/index/") || path.contains("/assets/") || path.contains("/chainlogos/") {
        "public, max-age=86400"
    } else {
        "public, max-age=3600"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_policy_matches_bun_server() {
        assert_eq!(cache_control_for("/index/fuse-chains.json"), "public, max-age=86400");
        assert_eq!(cache_control_for("/assets/eip155-1/0xabc/logo.png"), "public, max-age=86400");
        assert_eq!(cache_control_for("/chainlogos/eip155-1.png"), "public, max-age=86400");
        assert_eq!(cache_control_for("/chains/eip155-1.json"), "public, max-age=3600");
        assert_eq!(cache_control_for("/"), "public, max-age=3600");
    }

    #[test]
    fn health_body_is_valid_shape() {
        let body = health_body();
        assert!(body.starts_with('{') && body.ends_with('}'));
        assert!(body.contains(r#""status":"ok""#));
    }
}
