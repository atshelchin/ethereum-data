//! axum static file server for Docker / bare-metal deployment.
//!
//! Behavior mirrors the original Bun server (scripts/server.ts):
//! GET/HEAD only, permissive CORS, path-based Cache-Control, /api/health,
//! directory index.html, and SPA fallback to /index.html.

use std::{env, net::SocketAddr, path::PathBuf};

use axum::{
    extract::Request,
    http::{header, HeaderMap, HeaderValue, Method, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use ethereum_data_core::{cache_control_for, health_body, CORS_HEADERS};
use tower_http::services::{ServeDir, ServeFile};

#[tokio::main]
async fn main() {
    let port: u16 = env::var("PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(3000);
    let data_dir = PathBuf::from(env::var("DATA_DIR").unwrap_or_else(|_| ".".to_string()));

    let static_files = ServeDir::new(&data_dir)
        .append_index_html_on_directories(true)
        .fallback(ServeFile::new(data_dir.join("index.html")));

    let app = Router::new()
        .route("/api/health", get(health))
        .fallback_service(static_files)
        .layer(middleware::from_fn(cors_and_cache));

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .unwrap_or_else(|e| panic!("failed to bind {addr}: {e}"));
    println!(
        "🚀 ethereum-data server listening on http://{addr}, serving {}",
        data_dir.display()
    );
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("server error");
}

async fn health() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "application/json; charset=utf-8")],
        health_body(),
    )
}

fn apply_cors(headers: &mut HeaderMap) {
    for (name, value) in CORS_HEADERS {
        headers.insert(
            header::HeaderName::from_static(name),
            HeaderValue::from_static(value),
        );
    }
}

async fn cors_and_cache(req: Request, next: Next) -> Response {
    if req.method() == Method::OPTIONS {
        let mut res = StatusCode::NO_CONTENT.into_response();
        apply_cors(res.headers_mut());
        return res;
    }
    if req.method() != Method::GET && req.method() != Method::HEAD {
        let mut res = (StatusCode::METHOD_NOT_ALLOWED, "Method Not Allowed").into_response();
        apply_cors(res.headers_mut());
        return res;
    }

    let path = req.uri().path().to_owned();
    let mut res = next.run(req).await;
    apply_cors(res.headers_mut());
    if res.status().is_success() && !path.starts_with("/api/") {
        res.headers_mut().insert(
            header::CACHE_CONTROL,
            HeaderValue::from_static(cache_control_for(&path)),
        );
    }
    res
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c().await.ok();
    };
    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
