/**
 * Public image proxy to provide a stable, immediately readable image URL
 * for Webflow CMS to import from.
 *
 * Usage:
 *   GET /api/proxy-image?src=https%3A%2F%2Fwebflow.com%2Ffiles%2F...jpg
 *
 * Notes:
 * - We add a browser-like User-Agent and Accept headers.
 * - We lightly restrict allowed hosts to reduce abuse. Adjust ALLOWED_HOSTS if needed.
 * - Responses are short-cached. Tune Cache-Control to your needs.
 */

const ALLOWED_HOSTS = new Set([
  "webflow.com",
  "uploads-ssl.webflow.com",
  "cdn.prod.website-files.com",
  "s3.amazonaws.com",
]);

function isAllowedUrl(src) {
  try {
    const u = new URL(src);
    if (u.protocol !== "https:") return false;
    // Allow webflow.com subpaths like webflow.com/files/...
    if (u.hostname === "webflow.com") return true;
    return ALLOWED_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  const timestamp = new Date().toISOString();
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ error: "Method not allowed", timestamp });
  }

  const src = req.query?.src;
  if (!src || typeof src !== "string") {
    return res
      .status(400)
      .json({ error: "Missing src query param", timestamp });
  }
  if (!isAllowedUrl(src)) {
    return res
      .status(400)
      .json({ error: "Source URL not allowed", src, timestamp });
  }

  try {
    const upstream = await fetch(src, {
      method: req.method === "HEAD" ? "HEAD" : "GET",
      headers: {
        // Some origins are finicky with generic agents
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      redirect: "follow",
    });

    // Forward status
    if (req.method === "HEAD") {
      // Forward headers (sanitized) for HEAD
      const ct = upstream.headers.get("content-type") || "image/jpeg";
      res.setHeader("Content-Type", ct);
      res.setHeader(
        "Cache-Control",
        "public, max-age=120, s-maxage=120, stale-while-revalidate=60"
      );
      return res.status(upstream.status).end();
    }

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return res.status(502).json({
        error: "Upstream fetch failed",
        status: upstream.status,
        src,
        body: text?.slice(0, 4000),
        timestamp,
      });
    }

    const ct = upstream.headers.get("content-type") || "image/jpeg";
    const buf = Buffer.from(await upstream.arrayBuffer());

    res.setHeader("Content-Type", ct.startsWith("image/") ? ct : "image/jpeg");
    res.setHeader(
      "Cache-Control",
      "public, max-age=300, s-maxage=300, stale-while-revalidate=60"
    );
    res.status(200).end(buf);
  } catch (e) {
    return res
      .status(500)
      .json({ error: "Proxy error", message: e.message, src, timestamp });
  }
}
