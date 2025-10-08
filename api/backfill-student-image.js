/**
 * Backfill Student image field after form submission.
 * - Finds the Student item by itemId.
 * - Reads "campaign-photo-url" text field (or uses ?url=... if provided).
 * - Attaches the image to the "campaign-photo" image field using the proxy for reliable import.
 * - Publishes the updated item.
 *
 * Usage (manual):
 *   GET /api/backfill-student-image?itemId=STUDENT_ITEM_ID&siteId=SITE_ID
 *   (Optional) &url=https://cdn.prod.website-files.com/...jpg
 *   (Optional) &collectionId=STUDENT_COLLECTION_ID   // defaults to WEBFLOW_STUDENTSCRFD_COLLECTION_ID
 *   (Optional) &clearText=1                          // clear the text URL field after success
 *
 * Notes:
 * - Requires WEBFLOW_API_KEY in environment.
 */

export default async function handler(req, res) {
  const timestamp = new Date().toISOString();

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed", timestamp });
  }

  try {
    const apiKey = process.env.WEBFLOW_API_KEY;
    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "Missing WEBFLOW_API_KEY", timestamp });
    }

    const {
      itemId,
      url: urlParam,
      siteId,
      collectionId: qCollectionId,
      clearText,
    } = req.query || {};

    if (!itemId || typeof itemId !== "string") {
      return res.status(400).json({ error: "Missing itemId", timestamp });
    }
    if (!siteId || typeof siteId !== "string") {
      return res.status(400).json({ error: "Missing siteId", timestamp });
    }

    const collectionId =
      typeof qCollectionId === "string" && qCollectionId.length > 0
        ? qCollectionId
        : process.env.WEBFLOW_STUDENTSCRFD_COLLECTION_ID;

    if (!collectionId) {
      return res.status(400).json({
        error:
          "Missing Student collection id. Provide ?collectionId=... or set WEBFLOW_STUDENTSCRFD_COLLECTION_ID.",
        timestamp,
      });
    }

    // 1) Fetch schema to resolve field keys
    const schema = await fetchCollectionSchema(collectionId, apiKey, timestamp);

    const resolved = {
      campaignPhoto: resolveFieldKey(schema, [
        "campaign-photo",
        "campaign photo",
        "photo",
        "image",
        "cover-image",
      ]),
      campaignPhotoUrlText: resolveFieldKey(schema, [
        "campaign-photo-url",
        "photo-url",
        "image-url",
        "cover-image-url",
        "campaign-photo-link",
        "photo-link",
        "image-link",
      ]),
    };

    if (!resolved.campaignPhoto) {
      return res.status(400).json({
        error: "Could not resolve image field (campaign-photo) in schema",
        timestamp,
      });
    }

    // 2) Fetch current item
    const itemRes = await fetch(
      `https://api.webflow.com/v2/collections/${collectionId}/items/${itemId}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "accept-version": "2.0.0",
        },
      }
    );
    if (!itemRes.ok) {
      const t = await itemRes.text().catch(() => "");
      return res
        .status(itemRes.status)
        .json({ error: "Failed to fetch item", details: t, timestamp });
    }
    const itemJson = await itemRes.json();
    const item = itemJson?.item || itemJson;

    // Already has an image?
    const already = item?.fieldData?.[resolved.campaignPhoto];
    if (
      already &&
      typeof already === "object" &&
      typeof already.url === "string" &&
      already.url.length > 0
    ) {
      return res.status(200).json({
        message: "Image already set on campaign-photo",
        campaignPhoto: already,
        itemId,
        collectionId,
        timestamp,
      });
    }

    // 3) Determine source URL
    let sourceUrl = undefined;
    if (typeof urlParam === "string" && urlParam.length > 0) {
      sourceUrl = urlParam;
    } else if (resolved.campaignPhotoUrlText) {
      const txt = item?.fieldData?.[resolved.campaignPhotoUrlText];
      if (txt && typeof txt === "string" && txt.length > 0) {
        sourceUrl = txt;
      }
    }

    if (!sourceUrl) {
      return res.status(400).json({
        error:
          "No source URL available. Pass ?url=... or ensure the item has a campaign-photo-url text field set.",
        timestamp,
      });
    }

    // Normalize S3 to CDN if it's a Webflow S3 path
    const normalized = normalizeToCdnUrl(sourceUrl, siteId);

    // 4) Attach via proxy for reliable import
    const baseUrl = computeBaseUrl(req);
    const proxyUrl = `${baseUrl}/api/proxy-image?src=${encodeURIComponent(
      normalized
    )}`;

    const patchPayload = {
      items: [
        {
          id: itemId,
          isArchived: false,
          isDraft: false,
          fieldData: {
            ...(item.fieldData || {}),
            [resolved.campaignPhoto]: { url: proxyUrl },
            ...(resolved.campaignPhotoUrlText && !isTruthy(clearText)
              ? { [resolved.campaignPhotoUrlText]: normalized }
              : {}),
            ...(resolved.campaignPhotoUrlText && isTruthy(clearText)
              ? { [resolved.campaignPhotoUrlText]: "" }
              : {}),
          },
        },
      ],
    };

    const patchRes = await fetch(
      `https://api.webflow.com/v2/collections/${collectionId}/items`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "accept-version": "2.0.0",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patchPayload),
      }
    );

    if (!patchRes.ok) {
      const t = await patchRes.text().catch(() => "");
      return res.status(patchRes.status).json({
        error: "Failed to patch item with image",
        details: t,
        timestamp,
      });
    }

    const patchJson = await patchRes.json();

    // 5) Publish the item
    const publishRes = await fetch(
      `https://api.webflow.com/v2/collections/${collectionId}/items/publish`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "accept-version": "2.0.0",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ itemIds: [itemId] }),
      }
    );

    const publishOk = publishRes.ok || publishRes.status === 202;
    const publishBody = await publishRes.text().catch(() => "");
    return res.status(200).json({
      success: true,
      itemId,
      collectionId,
      attachedViaProxy: proxyUrl,
      normalizedSource: normalized,
      publish: { ok: publishOk, status: publishRes.status, body: publishBody },
      data: patchJson,
      timestamp,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Backfill failed",
      message: err?.message || "unknown",
      timestamp,
    });
  }
}

/* -------------- Helpers (mirrors from webhook) -------------- */

function computeBaseUrl(req) {
  const proto = (req.headers["x-forwarded-proto"] || "https").toString();
  const host = (
    req.headers["x-forwarded-host"] ||
    req.headers.host ||
    ""
  ).toString();
  return host ? `${proto}://${host}` : "";
}

async function fetchCollectionSchema(collectionId, apiKey, timestamp) {
  const url = `https://api.webflow.com/v2/collections/${collectionId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, "accept-version": "2.0.0" },
  });
  if (res.ok) {
    const json = await res.json();
    if (Array.isArray(json.fields) && json.fields.length > 0)
      return json.fields;
  }
  const fallbackUrl = `https://api.webflow.com/v2/collections/${collectionId}/fields`;
  const res2 = await fetch(fallbackUrl, {
    headers: { Authorization: `Bearer ${apiKey}`, "accept-version": "2.0.0" },
  });
  if (res2.ok) {
    const json2 = await res2.json();
    return json2.fields || json2.items || [];
  }
  return [];
}

function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveFieldKey(schemaFields, candidates) {
  if (!Array.isArray(schemaFields) || schemaFields.length === 0)
    return undefined;
  const normalizedCandidates = candidates.map((c) => normalize(c));
  for (const f of schemaFields) {
    const slug = normalize(f.slug || f.key || f.fieldId || f.id || "");
    if (normalizedCandidates.includes(slug))
      return f.slug || f.key || f.fieldId || f.id;
  }
  for (const f of schemaFields) {
    const name = normalize(f.name || f.displayName || f.label || "");
    if (normalizedCandidates.includes(name))
      return f.slug || f.key || f.fieldId || f.id;
  }
  for (const f of schemaFields) {
    const slug = normalize(f.slug || f.key || f.fieldId || f.id || "");
    const name = normalize(f.name || f.displayName || f.label || "");
    if (
      normalizedCandidates.some((c) => slug.includes(c) || name.includes(c))
    ) {
      return f.slug || f.key || f.fieldId || f.id;
    }
  }
  return undefined;
}

function normalizeToCdnUrl(urlStr, siteId) {
  try {
    if (!urlStr || !siteId) return urlStr;
    const u = new URL(urlStr);
    const isS3Webflow =
      u.hostname === "s3.amazonaws.com" &&
      u.pathname.startsWith(`/webflow-prod-assets/${siteId}/`);
    if (isS3Webflow) {
      const tail = u.pathname.split(`/webflow-prod-assets/${siteId}/`)[1] || "";
      return `https://cdn.prod.website-files.com/${siteId}/${tail}`;
    }
    return urlStr;
  } catch {
    return urlStr;
  }
}

function isTruthy(value) {
  const s = String(value ?? "")
    .toLowerCase()
    .trim();
  return (
    s === "1" || s === "true" || s === "yes" || s === "on" || value === true
  );
}
