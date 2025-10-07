/**
 * Backfill Student image field once the CDN URL becomes publicly readable.
 *
 * Usage (GET):
 *   /api/backfill-student-image?itemId=STUDENT_ITEM_ID
 *     [&url=CDN_OR_S3_URL]
 *     [&siteId=WEBFLOW_SITE_ID]
 *     [&collectionId=COLLECTION_ID] (defaults to WEBFLOW_STUDENTSCRFD_COLLECTION_ID)
 *     [&publish=true]                (default true)
 *     [&maxAttempts=20&baseDelayMs=2000&backoffFactor=1.8&maxDelayMs=12000]
 *
 * Usage (POST JSON):
 *   {
 *     "itemId": "STUDENT_ITEM_ID",
 *     "url": "https://cdn.prod.website-files.com/.../file.jpg",
 *     "siteId": "SITE_ID",
 *     "collectionId": "COLLECTION_ID",
 *     "publish": true,
 *     "maxAttempts": 20,
 *     "baseDelayMs": 2000,
 *     "backoffFactor": 1.8,
 *     "maxDelayMs": 12000,
 *     "clearTextUrlField": true
 *   }
 *
 * Behavior:
 *   - If "url" is omitted, this route attempts to read the Student item and use the text URL fallback
 *     field (e.g., "campaign-photo-url") as the source.
 *   - Normalizes S3 "webflow-prod-assets" URLs to the public "cdn.prod.website-files.com" form.
 *   - Polls readiness (HEAD then GET) until content-type is image/*, then sets the image field with { url }.
 *   - Optionally clears the text URL field afterwards (clearTextUrlField=true).
 *   - Publishes the item if publish=true (default).
 */

async function fetchCollectionSchema(collectionId, apiKey, timestamp) {
  const url = `https://api.webflow.com/v2/collections/${collectionId}`;
  console.log(`[${timestamp}] [backfill] Fetching collection schema: ${url}`);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, "accept-version": "2.0.0" },
  });
  if (res.ok) {
    const json = await res.json();
    if (Array.isArray(json.fields) && json.fields.length > 0) {
      console.log(
        `[${timestamp}] [backfill] Schema fields fetched: ${json.fields.length}`
      );
      return json.fields;
    }
  } else {
    console.warn(
      `[${timestamp}] [backfill] Failed to fetch schema (primary): ${
        res.status
      } - ${await res.text()}`
    );
  }

  const fallbackUrl = `https://api.webflow.com/v2/collections/${collectionId}/fields`;
  console.log(
    `[${timestamp}] [backfill] Fetching collection schema (fallback): ${fallbackUrl}`
  );
  const res2 = await fetch(fallbackUrl, {
    headers: { Authorization: `Bearer ${apiKey}`, "accept-version": "2.0.0" },
  });
  if (res2.ok) {
    const json2 = await res2.json();
    const fields = json2.fields || json2.items || [];
    console.log(
      `[${timestamp}] [backfill] Schema fields fetched via fallback: ${
        Array.isArray(fields) ? fields.length : 0
      }`
    );
    return fields;
  } else {
    console.warn(
      `[${timestamp}] [backfill] Failed to fetch schema (fallback): ${
        res2.status
      } - ${await res2.text()}`
    );
  }
  return [];
}

function normalize(s) {
  return String(s || "")
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

function getHostnameFromUrl(urlStr) {
  try {
    return new URL(urlStr).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isForbiddenAssetHost(urlStr) {
  const host = getHostnameFromUrl(urlStr);
  return host === "webflow.com" || host.endsWith(".webflow.com");
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
      const cdnUrl = `https://cdn.prod.website-files.com/${siteId}/${tail}`;
      return cdnUrl;
    }
    return urlStr;
  } catch {
    return urlStr;
  }
}

async function publishCmsItems(itemIds, collectionId, apiKey, timestamp) {
  try {
    console.log(
      `[${timestamp}] [backfill] Publishing CMS items: ${itemIds.join(
        ", "
      )} in collection: ${collectionId}`
    );
    const response = await fetch(
      `https://api.webflow.com/v2/collections/${collectionId}/items/publish`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "accept-version": "2.0.0",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ itemIds }),
      }
    );
    console.log(
      `[${timestamp}] [backfill] Bulk publish response status: ${response.status}`
    );
    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[${timestamp}] [backfill] Failed to publish items: ${response.status} - ${errorText}`
      );
      return { success: false, error: errorText, status: response.status };
    }
    const publishData = await response.json();
    console.log(
      `[${timestamp}] [backfill] Items published successfully:`,
      publishData
    );
    return { success: true, data: publishData };
  } catch (error) {
    console.error(
      `[${timestamp}] [backfill] Error publishing items:`,
      error.message
    );
    return { success: false, error: error.message };
  }
}

// Poll the CDN URL until it responds with an image content-type (or we give up)
async function waitForAssetReady(
  url,
  {
    maxAttempts = 20,
    baseDelayMs = 2000,
    backoffFactor = 1.8,
    maxDelayMs = 12000,
    expectedPrefix = "image/",
    timestamp = new Date().toISOString(),
  } = {}
) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let delay = baseDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // First try HEAD
      const head = await fetch(url, { method: "HEAD" });
      const ctHead = (head.headers.get("content-type") || "").toLowerCase();
      const okHead = head.ok && ctHead.startsWith(expectedPrefix);
      console.log(
        `[${timestamp}] [backfill] Readiness #${attempt} (HEAD): ${head.status} content-type="${ctHead}" ok=${okHead}`
      );
      if (okHead) return true;

      // Fallback to GET if HEAD not ready/blocked by CDN
      const getRes = await fetch(url, {
        method: "GET",
        headers: { Accept: "image/*" },
      });
      const ctGet = (getRes.headers.get("content-type") || "").toLowerCase();
      const okGet = getRes.ok && ctGet.startsWith(expectedPrefix);
      console.log(
        `[${timestamp}] [backfill] Readiness #${attempt} (GET): ${getRes.status} content-type="${ctGet}" ok=${okGet}`
      );
      if (okGet) return true;
    } catch (e) {
      console.warn(
        `[${timestamp}] [backfill] Readiness check error #${attempt}: ${e.message}`
      );
    }

    const jitter = Math.floor(Math.random() * 300);
    await sleep(Math.min(delay + jitter, maxDelayMs));
    delay = Math.min(Math.floor(delay * backoffFactor), maxDelayMs);
  }

  console.warn(
    `[${timestamp}] [backfill] Asset did not become ready after ${maxAttempts} attempts.`
  );
  return false;
}

async function getItem(collectionId, itemId, apiKey, timestamp) {
  // Try direct item endpoint, fallback to listing
  const directUrl = `https://api.webflow.com/v2/collections/${collectionId}/items/${itemId}`;
  try {
    const res = await fetch(directUrl, {
      headers: { Authorization: `Bearer ${apiKey}`, "accept-version": "2.0.0" },
    });
    if (res.ok) {
      const j = await res.json();
      // Some APIs return { item }, others return the item directly
      return j.item || j;
    } else {
      console.warn(
        `[${timestamp}] [backfill] GET item by ID failed: ${
          res.status
        } - ${await res.text()}`
      );
    }
  } catch (e) {
    console.warn(
      `[${timestamp}] [backfill] GET item by ID error: ${e.message}`
    );
  }

  // Fallback: list and find
  const listUrl = `https://api.webflow.com/v2/collections/${collectionId}/items`;
  const res2 = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${apiKey}`, "accept-version": "2.0.0" },
  });
  if (res2.ok) {
    const j2 = await res2.json();
    const items = Array.isArray(j2.items) ? j2.items : [];
    const found = items.find((it) => it.id === itemId);
    if (found) return found;
    console.warn(
      `[${timestamp}] [backfill] Item ${itemId} not found in collection listing`
    );
  } else {
    console.warn(
      `[${timestamp}] [backfill] List items failed: ${
        res2.status
      } - ${await res2.text()}`
    );
  }
  return null;
}

export default async function handler(req, res) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [backfill] Route invoked`);

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
      expected: "GET or POST",
      timestamp,
    });
  }

  try {
    const body = req.method === "POST" ? req.body || {} : {};
    const query = req.method === "GET" ? req.query || {} : {};

    const itemId = body.itemId || query.itemId;
    let url = body.url || query.url || null;
    let siteId = body.siteId || query.siteId || null;
    const publish =
      (body.publish ?? query.publish ?? "true").toString() !== "false";
    const clearTextUrlField =
      (
        body.clearTextUrlField ??
        query.clearTextUrlField ??
        "false"
      ).toString() === "true";

    const collectionId =
      body.collectionId ||
      query.collectionId ||
      process.env.WEBFLOW_STUDENTSCRFD_COLLECTION_ID ||
      null;
    const apiKey = process.env.WEBFLOW_API_KEY;

    const tunables = {
      maxAttempts: Number(body.maxAttempts || query.maxAttempts || 20),
      baseDelayMs: Number(body.baseDelayMs || query.baseDelayMs || 2000),
      backoffFactor: Number(body.backoffFactor || query.backoffFactor || 1.8),
      maxDelayMs: Number(body.maxDelayMs || query.maxDelayMs || 12000),
      timestamp,
    };

    if (!apiKey)
      return res
        .status(500)
        .json({ error: "Missing WEBFLOW_API_KEY", timestamp });
    if (!collectionId) {
      return res.status(400).json({
        error:
          "Missing collectionId. Provide ?collectionId= or set WEBFLOW_STUDENTSCRFD_COLLECTION_ID",
        timestamp,
      });
    }
    if (!itemId) {
      return res.status(400).json({ error: "Missing itemId", timestamp });
    }

    // Resolve schema and target fields
    const schema = await fetchCollectionSchema(collectionId, apiKey, timestamp);
    const keyCampaignPhoto = resolveFieldKey(schema, [
      "campaign-photo",
      "campaign photo",
      "photo",
      "image",
      "cover-image",
    ]);
    const keyPhotoUrlText = resolveFieldKey(schema, [
      "campaign-photo-url",
      "photo-url",
      "image-url",
      "cover-image-url",
      "campaign-photo-link",
      "photo-link",
      "image-link",
    ]);
    const keyUserName = resolveFieldKey(schema, [
      "user-name",
      "user name",
      "username",
    ]);
    if (!keyCampaignPhoto) {
      return res.status(500).json({
        error: "Could not resolve Student image field key (campaign-photo)",
        timestamp,
      });
    }

    // If URL not provided, derive it from the item (prefers text URL fallback)
    let item = null;
    if (!url || !siteId) {
      item = await getItem(collectionId, itemId, apiKey, timestamp);
      if (!item) {
        return res
          .status(404)
          .json({ error: `Item not found: ${itemId}`, timestamp });
      }
      const fd = item.fieldData || {};

      if (!url) {
        url =
          (keyPhotoUrlText && fd[keyPhotoUrlText]) ||
          (fd[keyCampaignPhoto]?.url ?? null) ||
          null;
      }
      if (!siteId) {
        // Try to extract from CDN path if present
        try {
          if (url) {
            const u = new URL(url);
            if (u.hostname === "cdn.prod.website-files.com") {
              const maybeSiteId = (u.pathname.split("/")[1] || "").trim();
              if (maybeSiteId) siteId = maybeSiteId;
            }
          }
        } catch {
          // ignore
        }
      }
    }

    if (!url) {
      return res.status(400).json({
        error: "No URL to backfill. Pass ?url= or ensure item has a text URL.",
        timestamp,
      });
    }

    // Normalize S3 to CDN if possible
    const finalUrl = siteId ? normalizeToCdnUrl(url, siteId) : url;
    if (finalUrl !== url) {
      console.log(
        `[${timestamp}] [backfill] Normalized URL to CDN: ${finalUrl}`
      );
    }

    // If forbidden host (webflow.com/formUploads), we cannot use directly here.
    if (isForbiddenAssetHost(finalUrl)) {
      return res.status(400).json({
        error:
          "Provided URL is a forbidden host (webflow.com/formUploads). Please pass a rehosted CDN URL or a normalized S3/CDN URL.",
        url: finalUrl,
        timestamp,
      });
    }

    // Wait until the CDN returns image/*
    const ready = await waitForAssetReady(finalUrl, tunables);
    if (!ready) {
      return res.status(202).json({
        ok: false,
        reason: "not-ready",
        message: "CDN URL is not public yet. Try again later.",
        url: finalUrl,
        itemId,
        collectionId,
        timestamp,
      });
    }

    // Patch the item to set the image field
    const currentItem =
      item || (await getItem(collectionId, itemId, apiKey, timestamp));
    if (!currentItem) {
      return res
        .status(404)
        .json({ error: `Item not found before patch: ${itemId}`, timestamp });
    }

    const patchFieldData = {
      ...(currentItem.fieldData || {}),
      [keyCampaignPhoto]: { url: finalUrl },
    };
    if (clearTextUrlField && keyPhotoUrlText) {
      delete patchFieldData[keyPhotoUrlText];
    }

    const patchPayload = {
      items: [
        {
          id: itemId,
          isArchived: false,
          isDraft: false,
          fieldData: patchFieldData,
        },
      ],
    };

    console.log(
      `[${timestamp}] [backfill] Patching Student image field for item ${itemId}`
    );
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
      const errText = await patchRes.text();
      console.error(
        `[${timestamp}] [backfill] Failed to patch item: ${patchRes.status} - ${errText}`
      );
      return res
        .status(500)
        .json({ error: "Failed to patch item", details: errText, timestamp });
    }

    const patchJson = await patchRes.json();
    console.log(
      `[${timestamp}] [backfill] Image field patched successfully for item ${itemId}`
    );

    // Publish if requested
    let publishResult = { success: false };
    if (publish) {
      publishResult = await publishCmsItems(
        [itemId],
        collectionId,
        apiKey,
        timestamp
      );
    }

    return res.status(200).json({
      ok: true,
      message: "Backfill completed",
      itemId,
      collectionId,
      siteId: siteId || null,
      imageUrl: finalUrl,
      clearedTextUrlField:
        clearTextUrlField && !!resolveFieldKey(schema, ["campaign-photo-url"]),
      publishResult,
      patched: patchJson,
      userName:
        (currentItem.fieldData && currentItem.fieldData[keyUserName]) || null,
      timestamp,
    });
  } catch (error) {
    console.error(`[${timestamp}] [backfill] Unexpected error:`, error.message);
    console.error(`[${timestamp}] [backfill] Stack:`, error.stack);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
      timestamp,
    });
  }
}
