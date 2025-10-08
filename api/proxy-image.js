/**
 * Image proxy for reliable Webflow CMS imports.
 * - GET: streams the source image with correct image/* content-type
 * - HEAD: returns headers only (best-effort), useful for readiness checks
 *
 * Usage:
 *   GET /api/proxy-image?src=https%3A%2F%2Fwebflow.com%2Ffiles%2F...%2FformUploads%2Fphoto.jpg
 *
 * Security:
 * - Allowlist of trusted hosts to prevent SSRF.
 * - Adds a browser-like User-Agent and Accept header to maximize compatibility.
 */
export default async function handler(req, res) {
  try {
    const timestamp = new Date().toISOString();
    const { src } = req.query || {};

    if (!src || typeof src !== "string") {
      return res.status(400).json({ error: "Missing src query parameter" });
    }

    let decoded;
    try {
      decoded = decodeURIComponent(src);
    } catch {
      decoded = src;
    }

    let url;
    try {
      url = new URL(decoded);
    } catch {
      return res.status(400).json({ error: "Invalid src URL" });
    }

    // Allowlist trusted hosts (expand if needed)
    const allowedHosts = [
      // Webflow form uploads and CDN
      "webflow.com",
      "uploads-ssl.webflow.com",
      "cdn.prod.website-files.com",
      // Webflow S3 backing store
      "s3.amazonaws.com",
    ];

    const hostAllowed = allowedHosts.some(
      (h) => url.hostname === h || url.hostname.endsWith(`.${h}`)
    );
    if (!hostAllowed) {
      return res
        .status(400)
        .json({ error: `Host not allowed: ${url.hostname}` });
    }

    // Attempt HEAD first for HEAD requests; fallback to GET
    const method = req.method === "HEAD" ? "HEAD" : "GET";

    const commonHeaders = {
      // Present as a browser to avoid certain anti-bot blocks
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/*;q=0.8,*/*;q=0.5",
      "Accept-Language": "en-US,en;q=0.9",
      // Some CDNs behave slightly better with a Referer; keep it minimal and same-origin as proxy host
      Referer: `${req.headers["x-forwarded-proto"] || "https"}://${
        req.headers["x-forwarded-host"] || req.headers.host || "localhost"
      }/`,
    };

    let upstream = await fetch(url.toString(), {
      method,
      headers: commonHeaders,
    });
    // Some hosts do not support HEAD properly. If HEAD failed, try GET to at least collect headers.
    if (req.method === "HEAD" && !upstream.ok) {
      upstream = await fetch(url.toString(), {
        method: "GET",
        headers: commonHeaders,
      });
    }

    // If still not ok, bubble up minimal info for debugging
    if (!upstream.ok) {
      const body = await upstream.text().catch(() => "");
      res.setHeader("X-Proxy-Source-Status", String(upstream.status));
      res.setHeader(
        "X-Proxy-Source-CT",
        upstream.headers.get("content-type") || "none"
      );
      return res.status(502).send(body || `Upstream error: ${upstream.status}`);
    }

    const contentType = upstream.headers.get("content-type") || "";
    // If content-type is not image/*, try to guess from extension as a best effort
    let finalCT = contentType.startsWith("image/")
      ? contentType
      : guessContentTypeFromPath(url.pathname);
    if (!finalCT.startsWith("image/")) {
      // Force a safe default so Webflow attempts to import as image
      finalCT = "image/jpeg";
    }

    // Set caching headers (short TTL)
    res.setHeader(
      "Cache-Control",
      "public, max-age=60, s-maxage=60, stale-while-revalidate=120"
    );
    res.setHeader("Content-Type", finalCT);
    res.setHeader("X-Proxy-Source-Status", String(upstream.status));
    res.setHeader("X-Proxy-Source-CT", contentType || "none");

    if (req.method === "HEAD") {
      // Headers only
      return res.status(200).end();
    }

    // Stream/forward body
    const ab = await upstream.arrayBuffer();
    res.status(200).send(Buffer.from(ab));
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Proxy failed", message: err?.message || "unknown" });
  }
}

function guessContentTypeFromPath(pathname) {
  const lower = pathname.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".avif")) return "image/avif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}
