//! Cloudflare Worker for the API layer.
//!
//! Static files are served by Workers Static Assets before this code runs
//! (see `run_worker_first = ["/api/*"]` in wrangler.toml), so this Worker
//! only ever sees `/api/*` requests. CORS / Cache-Control for static files
//! live in the `_headers` file at the repo root.

use ethereum_data_core::{health_body, CORS_HEADERS};
use worker::*;

fn with_cors(mut res: Response) -> Response {
    let headers = res.headers_mut();
    for (name, value) in CORS_HEADERS {
        let _ = headers.set(name, value);
    }
    res
}

#[event(fetch)]
async fn fetch(req: Request, _env: Env, _ctx: Context) -> Result<Response> {
    if req.method() == Method::Options {
        return Ok(with_cors(Response::empty()?.with_status(204)));
    }
    if req.method() != Method::Get && req.method() != Method::Head {
        return Ok(with_cors(Response::error("Method Not Allowed", 405)?));
    }

    match req.path().as_str() {
        "/api/health" => {
            let mut res = Response::ok(health_body())?;
            res.headers_mut()
                .set("Content-Type", "application/json; charset=utf-8")?;
            Ok(with_cors(res))
        }
        _ => Ok(with_cors(Response::error("Not Found", 404)?)),
    }
}
