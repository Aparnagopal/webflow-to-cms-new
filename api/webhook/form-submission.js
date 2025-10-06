/**
 * Webflow multi-form webhook with:
 * - Corrected field mappings for General Application
 * - Dynamic status override based on "form-action"
 * - Explicit publishing to avoid "Queued to publish"
 * - Creates Student Profile in WEBFLOW_STUDENTSCRFD_COLLECTION_ID when Application is Submitted
 * - Aligns to current Student collection schema by fetching fields at runtime
 * - NEW: Rehost formUploads assets to Webflow Assets API, then attach CDN URL to CMS
 */

const FORM_CONFIGS = {
  // Crowd Funding Donor comments form
  "6852c7791d84f17a29ace6f0": {
    name: "Student Crowd Funding Donor Comments",
    collectionId: process.env.WEBFLOW_DONOR_COMMENTS_COLLECTION_ID,
    fieldMapping: {
      DonorName: "name",
      DonorMessage: "donor-message",
      StudentProfile: "student-profile",
    },
    requiredFields: ["DonorName"],
    referenceFields: {
      "student-profile": {
        collectionId: process.env.WEBFLOW_STUDENTSCRFD_COLLECTION_ID,
        lookupField: "name",
        createIfNotFound: false,
        fallbackToText: true,
      },
    },
    updateStudentRecord: {
      enabled: true,
      collectionId: process.env.WEBFLOW_STUDENTSCRFD_COLLECTION_ID,
      lookupField: "name",
      updateField: "donor-message",
      isMultiReference: true,
    },
    generateSlug: (data) => {
      try {
        const donorName = data.DonorName || "donor";
        return `donor-${donorName
          .toLowerCase()
          .replace(/\s+/g, "-")}-${Date.now()}`;
      } catch {
        return `donor-submission-${Date.now()}`;
      }
    },
    generateMessageDateTime: () => new Date().toISOString(),
  },

  // General Applications form
  "682602bb5760376d719623dc": {
    name: "General Applications",
    collectionId: process.env.WEBFLOW_GENRLAPPL_COLLECTION_ID,
    fieldMapping: {
      "first-name": "first-name",
      "last-name": "last-name",
      email: "email",
      phone: "phone",
      "user-name": "name",
      "date-of-birth": "date-of-birth",
      school: "school",
      "school-year": "school-year",
      degree: "degree",
      major: "major",
      "anticipated-graduation-date": "anticipated-graduation-date",
      "full-time": "full-time",
      "required-credits": "required-credits",
      "remaining-credits": "required-credits",
      gpa: "gpa",
      address: "address",
      city: "city",
      state: "state",
      zip: "zip",
      "current-address-checkbox": "current-address-checkbox",
      "residency-duration": "residency-duration",
      "funding-opportunities": "funding-opportunities",
      "funding-term": "funding-term",
      "employment-status": "employment-status",
      "other-sources-of-income": "other-sources-of-income",
      "total-monthly-income": "total-monthly-income",
      "monthly-housing-payment": "monthly-housing-payment",
      "have-debt": "have-debt",
      "total-debt-amount": "total-debt-amount",
      "funding-need-story": "funding-need-story",
      "career-aspirations-and-goals": "career-aspirations-and-goals",
      "volunteering-activities": "volunteering-activities",
      "story-url": "story-url",
      "story-video": "story-video",
      "campaign-plan": "campaign-plan",
      "donation-support-amount": "donation-support-amount",
      ethnicity: "ethnicity",
      "residency-status": "residency-status",
      gender: "gender",
      "disability-status": "disability-status",
      "military-status": "military-status",
      "first-gen-student": "first-gen-student",
      "additional-comments": "additional-comments",
      "affirmation-check": "affirmation-check",
      "disclosure-signed-name": "disclosure-signed-name",
      "disclosure-signed-date": "disclosure-signed-date",
      "terms-acceptance-check": "terms-acceptance-check",
      "form-signed-name": "form-signed-name",
      "form-signed-date": "form-signed-date",
    },
    requiredFields: ["first-name", "last-name", "email"],
    referenceFields: {},
    updateExistingRecord: {
      enabled: true,
      lookupField: "name",
      statusField: "application-status",
      statusValue: "Draft",
    },
    statusOverride: {
      enabled: true,
      field: "application-status",
      getValue: (formData) => {
        const formAction = formData["form-action"];
        if (formAction === "save") return "Draft";
        if (formAction === "submit") return "Submitted";
        const hasRequiredSignatures =
          formData["disclosure-signed-name"] && formData["form-signed-name"];
        const hasAcceptedTerms = formData["terms-acceptance-check"] === "true";
        const hasAffirmation = formData["affirmation-check"] === "true";
        if (hasRequiredSignatures && hasAcceptedTerms && hasAffirmation)
          return "Submitted";
        return "Draft";
      },
    },
    generateSlug: (data) => {
      try {
        const name =
          data["last-name"] ||
          data["first-name"] ||
          data["email"] ||
          "application";
        return `application-${name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")}-${Date.now()}`;
      } catch {
        return `application-${Date.now()}`;
      }
    },
    addAutomaticFields: false,
    createStudentOnSubmit: {
      enabled: true,
      studentCollectionId: process.env.WEBFLOW_STUDENTSCRFD_COLLECTION_ID,
    },
  },
};

// --- Utilities ---

function isAutomatedRequest(req) {
  const userAgent = req.headers["user-agent"] || "";
  const referer = req.headers["referer"] || "";
  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /monitor/i,
    /health/i,
    /check/i,
    /ping/i,
    /curl/i,
    /wget/i,
    /postman/i,
    /insomnia/i,
  ];
  const isBot = botPatterns.some((p) => p.test(userAgent));
  const hasNoReferer = !referer;
  const hasEmptyBody = !req.body || Object.keys(req.body).length === 0;
  return {
    isBot,
    hasNoReferer,
    hasEmptyBody,
    userAgent,
    referer,
    isLikelyAutomated: isBot || (hasNoReferer && hasEmptyBody),
  };
}

function sanitizeSlug(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toNumberIfPossible(value) {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
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

async function publishCmsItems(itemIds, collectionId, apiKey, timestamp) {
  try {
    console.log(
      `[${timestamp}] Publishing CMS items: ${itemIds.join(
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
      `[${timestamp}] Bulk publish response status: ${response.status}`
    );
    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[${timestamp}] Failed to publish items: ${response.status} - ${errorText}`
      );
      return { success: false, error: errorText, status: response.status };
    }
    const publishData = await response.json();
    console.log(`[${timestamp}] Items published successfully:`, publishData);
    return { success: true, data: publishData };
  } catch (error) {
    console.error(`[${timestamp}] Error publishing items:`, error.message);
    return { success: false, error: error.message };
  }
}

// --- Reference helpers for donor comments ---

async function lookupReferenceItem(value, referenceConfig, apiKey, timestamp) {
  try {
    console.log(
      `[${timestamp}] Looking up reference item: "${value}" in collection: ${referenceConfig.collectionId}`
    );
    if (!referenceConfig.collectionId) return null;
    const response = await fetch(
      `https://api.webflow.com/v2/collections/${referenceConfig.collectionId}/items`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "accept-version": "2.0.0",
        },
      }
    );
    console.log(
      `[${timestamp}] Reference lookup response status: ${response.status}`
    );
    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[${timestamp}] Failed to fetch reference items: ${response.status} - ${errorText}`
      );
      return null;
    }
    const data = await response.json();
    const items = data.items || [];
    const matchingItem = items.find((item) => {
      const itemValue = item.fieldData[referenceConfig.lookupField];
      return (
        itemValue &&
        itemValue.toLowerCase().trim() === String(value).toLowerCase().trim()
      );
    });
    return matchingItem ? { id: matchingItem.id, item: matchingItem } : null;
  } catch (error) {
    console.error(
      `[${timestamp}] Error looking up reference item:`,
      error.message
    );
    return null;
  }
}

async function checkForExistingRecord(
  userName,
  updateConfig,
  collectionId,
  apiKey,
  timestamp
) {
  try {
    console.log(
      `[${timestamp}] Checking for existing record with name: "${userName}" and status: "${updateConfig.statusValue}"`
    );
    if (!updateConfig.enabled) return null;
    const response = await fetch(
      `https://api.webflow.com/v2/collections/${collectionId}/items`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "accept-version": "2.0.0",
        },
      }
    );
    console.log(
      `[${timestamp}] Existing record lookup response status: ${response.status}`
    );
    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[${timestamp}] Failed to fetch existing records: ${response.status} - ${errorText}`
      );
      return null;
    }
    const data = await response.json();
    const items = data.items || [];
    const existingItem = items.find((item) => {
      const nameValue = item.fieldData[updateConfig.lookupField];
      const statusValue = item.fieldData[updateConfig.statusField];
      const nameMatch =
        nameValue &&
        nameValue.toLowerCase().trim() ===
          String(userName).toLowerCase().trim();
      const statusMatch =
        statusValue &&
        statusValue.toLowerCase().trim() ===
          updateConfig.statusValue.toLowerCase().trim();
      return nameMatch && statusMatch;
    });
    if (existingItem) {
      console.log(
        `[${timestamp}] Found existing Draft record: ${existingItem.id} for "${userName}"`
      );
      return { id: existingItem.id, item: existingItem, canUpdate: true };
    }
    console.log(
      `[${timestamp}] No existing Draft record found for: "${userName}"`
    );
    return null;
  } catch (error) {
    console.error(
      `[${timestamp}] Error checking for existing record:`,
      error.message
    );
    return null;
  }
}

async function updateStudentRecord(
  studentName,
  donorCommentId,
  updateConfig,
  apiKey,
  timestamp
) {
  try {
    if (!updateConfig.enabled || !updateConfig.collectionId)
      return { success: false, reason: "Update not enabled" };
    if (!donorCommentId)
      return { success: false, reason: "No donor comment ID provided" };
    const response = await fetch(
      `https://api.webflow.com/v2/collections/${updateConfig.collectionId}/items`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "accept-version": "2.0.0",
        },
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[${timestamp}] Failed to fetch student items: ${response.status} - ${errorText}`
      );
      return { success: false, error: errorText };
    }
    const data = await response.json();
    const items = data.items || [];
    const studentItem = items.find((item) => {
      const itemValue = item.fieldData[updateConfig.lookupField];
      return (
        itemValue &&
        itemValue.toLowerCase().trim() ===
          String(studentName).toLowerCase().trim()
      );
    });
    if (!studentItem)
      return { success: false, reason: `Student not found: ${studentName}` };
    const currentDonorMessages =
      studentItem.fieldData[updateConfig.updateField] || [];
    const currentReferences = Array.isArray(currentDonorMessages)
      ? currentDonorMessages
      : [];
    if (currentReferences.includes(donorCommentId)) {
      return {
        success: true,
        reason: "Donor comment already referenced",
        noUpdate: true,
      };
    }
    const updatedReferences = [...currentReferences, donorCommentId];
    const updatePayload = {
      items: [
        {
          id: studentItem.id,
          isArchived: false,
          isDraft: false,
          fieldData: {
            ...studentItem.fieldData,
            [updateConfig.updateField]: updatedReferences,
          },
        },
      ],
    };
    const updateResponse = await fetch(
      `https://api.webflow.com/v2/collections/${updateConfig.collectionId}/items`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "accept-version": "2.0.0",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatePayload),
      }
    );
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error(
        `[${timestamp}] Failed to update student record: ${updateResponse.status} - ${errorText}`
      );
      return { success: false, error: errorText };
    }
    const updateResult = await updateResponse.json();
    return {
      success: true,
      studentId: studentItem.id,
      updatedField: updateConfig.updateField,
      addedReference: donorCommentId,
      totalReferences: updatedReferences.length,
      allReferences: updatedReferences,
      data: updateResult,
    };
  } catch (error) {
    console.error(
      `[${timestamp}] Error updating student record:`,
      error.message
    );
    return { success: false, error: error.message };
  }
}

// --- Schema helpers for Student collection ---

async function fetchCollectionSchema(collectionId, apiKey, timestamp) {
  const url = `https://api.webflow.com/v2/collections/${collectionId}`;
  console.log(`[${timestamp}] Fetching collection schema: ${url}`);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, "accept-version": "2.0.0" },
  });
  if (res.ok) {
    const json = await res.json();
    if (Array.isArray(json.fields) && json.fields.length > 0) {
      console.log(
        `[${timestamp}] Schema fields fetched: ${json.fields.length}`
      );
      return json.fields;
    }
  } else {
    console.warn(
      `[${timestamp}] Failed to fetch schema (primary): ${
        res.status
      } - ${await res.text()}`
    );
  }

  const fallbackUrl = `https://api.webflow.com/v2/collections/${collectionId}/fields`;
  console.log(
    `[${timestamp}] Fetching collection schema (fallback): ${fallbackUrl}`
  );
  const res2 = await fetch(fallbackUrl, {
    headers: { Authorization: `Bearer ${apiKey}`, "accept-version": "2.0.0" },
  });
  if (res2.ok) {
    const json2 = await res2.json();
    const fields = json2.fields || json2.items || [];
    console.log(
      `[${timestamp}] Schema fields fetched via fallback: ${
        Array.isArray(fields) ? fields.length : 0
      }`
    );
    return fields;
  } else {
    console.warn(
      `[${timestamp}] Failed to fetch schema (fallback): ${
        res2.status
      } - ${await res2.text()}`
    );
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

// Find a schema field by slug/key
function findSchemaField(schemaFields, keyOrSlug) {
  if (!Array.isArray(schemaFields)) return undefined;
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const target = norm(keyOrSlug);
  return schemaFields.find((f) => {
    const slug = norm(f.slug || f.key || f.fieldId || f.id || "");
    return slug === target;
  });
}

// Attempt to read a field's max length from the schema (fallback to default if missing)
function getMaxLengthForField(schemaFields, keyOrSlug, fallback = 500) {
  const f = findSchemaField(schemaFields, keyOrSlug);
  if (!f) return fallback;
  // Try a variety of possible shapes
  // Common: f.validations?.maxLength, f.maxLength, f.charLimit
  const v = f.validations || f.validation || {};
  if (typeof f.maxLength === "number") return f.maxLength;
  if (typeof f.charLimit === "number") return f.charLimit;
  if (typeof v.maxLength === "number") return v.maxLength;
  // Some APIs use arrays of rules
  if (Array.isArray(v)) {
    const ml = v.find((r) => r && (r.maxLength || r.maximum || r.limit));
    if (ml) return ml.maxLength || ml.maximum || ml.limit || fallback;
  }
  if (typeof v.maximum === "number") return v.maximum;
  return fallback;
}

function truncateToMaxLength(value, maxLen) {
  if (typeof value !== "string") return value;
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen);
}

// --- NEW: Rehost a remote asset to Webflow Assets API and return CDN URL ---

async function rehostToWebflowAssets({ sourceUrl, siteId, apiKey, timestamp }) {
  // Helper to compute SHA-256 hex with Node crypto when available, else Web Crypto
  async function sha256HexFromBuffer(buf) {
    try {
      // Prefer Node's crypto (dynamic import to avoid top-level import)
      const cryptoModule = await import("crypto");
      const hash = cryptoModule
        .createHash("sha256")
        .update(Buffer.from(buf))
        .digest("hex");
      return hash;
    } catch {
      try {
        const wc =
          globalThis.crypto?.subtle ||
          (await import("crypto")).webcrypto?.subtle;
        const hashBuffer = await wc.digest("SHA-256", buf);
        const bytes = new Uint8Array(hashBuffer);
        return Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      } catch {
        return null;
      }
    }
  }

  function getExtFromContentType(ct) {
    if (!ct) return ".bin";
    const t = ct.split("/")[1]?.split(";")[0] || "bin";
    return "." + t.replace(/[^a-z0-9]/gi, "");
  }

  // START UPDATED parseCdnUrl
  async function parseCdnUrl(uploadRes) {
    const text = await uploadRes.text().catch(() => "");
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      // Non-JSON response
    }

    console.log(`[${timestamp}] Assets upload status: ${uploadRes.status}`);

    // Consider 200-299 and 202 as potentially successful
    if (!uploadRes.ok && uploadRes.status !== 202) {
      console.error(
        `[${timestamp}] Assets upload failed: ${uploadRes.status} - ${
          text || "(no body)"
        }`
      );
      return { ok: false, json };
    }

    // Accept any of these as the CDN URL, prioritizing hostedUrl (CDN) over S3 URL
    const candidates = [
      json?.hostedUrl,
      json?.assetUrl,
      json?.url,
      json?.cdnUrl,
      json?.files?.[0]?.url,
      json?.files?.[0]?.cdnUrl,
      json?.assets?.[0]?.url,
      json?.assets?.[0]?.cdnUrl,
    ].filter(Boolean);

    if (candidates.length > 0) {
      const chosen = candidates[0];
      console.log(`[${timestamp}] Asset URL resolved: ${chosen}`);
      // Pull asset id and content type when present (JSON A shape)
      const assetId = json?.id || json?.files?.[0]?.id || json?.assets?.[0]?.id;
      const contentType =
        json?.contentType ||
        json?.files?.[0]?.contentType ||
        json?.assets?.[0]?.contentType;
      return { ok: true, url: chosen, assetId, contentType, json };
    }

    console.warn(
      `[${timestamp}] Could not find CDN URL in assets response: ${
        text || JSON.stringify(json)
      }`
    );
    return { ok: false, json };
  }
  // END UPDATED parseCdnUrl

  try {
    console.log(`[${timestamp}] Rehosting asset from source: ${sourceUrl}`);
    const fileRes = await fetch(sourceUrl);
    if (!fileRes.ok) {
      const t = await fileRes.text().catch(() => "");
      console.error(
        `[${timestamp}] Failed to fetch source asset: ${fileRes.status} - ${t}`
      );
      return { ok: false, reason: `fetch-failed-${fileRes.status}` };
    }

    const contentType =
      fileRes.headers.get("content-type") || "application/octet-stream";
    const path = (() => {
      try {
        return new URL(sourceUrl).pathname || "";
      } catch {
        return "";
      }
    })();
    const extFromPath = (path.split(".").pop() || "").toLowerCase();
    const ab = await fileRes.arrayBuffer();
    const buf = Buffer.from(ab);
    const base64 = buf.toString("base64");
    const fileHash = await sha256HexFromBuffer(ab); // hex string or null if unavailable
    const guessedExt =
      extFromPath && extFromPath.length <= 5
        ? `.${extFromPath.replace(/[^a-z0-9]/g, "")}`
        : getExtFromContentType(contentType);
    const filename = `upload-${Date.now()}${guessedExt}`;
    const uploadUrl = `https://api.webflow.com/v2/sites/${siteId}/assets`;

    // Attempt 1: JSON body (Shape A) with required fileHash
    console.log(
      `[${timestamp}] Uploading to Webflow Assets (JSON A with fileHash): ${uploadUrl} as ${filename}`
    );
    let res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "accept-version": "2.0.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: filename,
        contentType,
        data: base64, // base64 only
        ...(fileHash ? { fileHash } : {}), // include if available
      }),
    });
    let parsed = await parseCdnUrl(res);
    if (parsed.ok) {
      console.log(
        `[${timestamp}] Asset rehosted successfully (JSON A): ${parsed.url}`
      );
      // START UPDATED SUCCESS RETURN
      return {
        ok: true,
        url: parsed.url,
        assetId: parsed.assetId,
        contentType: parsed.contentType,
        raw: parsed.json,
      };
      // END UPDATED SUCCESS RETURN
    }
    console.warn(
      `[${timestamp}] JSON A upload failed; trying JSON B (files array) with fileHash`
    );

    // Attempt 2: JSON body (Shape B) with files array + fileHash per file
    res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "accept-version": "2.0.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: [
          {
            fileName: filename,
            contentType,
            data: base64,
            ...(fileHash ? { fileHash } : {}),
          },
        ],
      }),
    });
    parsed = await parseCdnUrl(res);
    if (parsed.ok) {
      console.log(
        `[${timestamp}] Asset rehosted successfully (JSON B): ${parsed.url}`
      );
      // START UPDATED SUCCESS RETURN
      return {
        ok: true,
        url: parsed.url,
        assetId: parsed.assetId,
        contentType: parsed.contentType,
        raw: parsed.json,
      };
      // END UPDATED SUCCESS RETURN
    }
    console.warn(
      `[${timestamp}] JSON B upload failed; trying multipart fallback`
    );

    // Attempt 3: multipart/form-data fallback (kept for older implementations)
    const form = new FormData();
    form.append("fileName", filename);
    form.append("file", new Blob([ab], { type: contentType }), filename);
    if (fileHash) form.append("fileHash", fileHash);

    const resMultipart = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "accept-version": "2.0.0",
      },
      body: form,
    });
    parsed = await parseCdnUrl(resMultipart);
    if (parsed.ok) {
      console.log(
        `[${timestamp}] Asset rehosted successfully (multipart): ${parsed.url}`
      );
      // START UPDATED SUCCESS RETURN
      return {
        ok: true,
        url: parsed.url,
        assetId: parsed.assetId,
        contentType: parsed.contentType,
        raw: parsed.json,
      };
      // END UPDATED SUCCESS RETURN
    }

    console.warn(
      `[${timestamp}] All rehost attempts failed; will fall back to text field if available.`
    );
    return { ok: false, reason: "all-attempts-failed", error: parsed.json };
  } catch (e) {
    console.error(`[${timestamp}] Error rehosting asset:`, e.message);
    return { ok: false, reason: "exception", error: e.message };
  }
}

/**
 * Ensure a Student record exists for a given user-name when an application is Submitted.
 * Aligns to current Student collection schema by fetching fields and resolving keys at runtime.
 * Rehosts formUploads image to Webflow Assets to get a CDN URL for the campaign-photo field.
 */
async function ensureStudentRecordForUser({
  formData,
  studentCollectionId,
  siteId,
  apiKey,
  timestamp,
}) {
  try {
    if (!studentCollectionId) {
      console.log(
        `[${timestamp}] Student creation skipped: missing WEBFLOW_STUDENTSCRFD_COLLECTION_ID`
      );
      return { created: false, reason: "Missing student collection id" };
    }

    const userNameFromForm =
      formData["user-name"] || formData["UserName"] || "";
    if (!userNameFromForm) {
      console.log(
        `[${timestamp}] Student creation skipped: missing user-name in General Application form`
      );
      return { created: false, reason: "Missing user-name in form" };
    }

    // Read Student schema
    const schema = await fetchCollectionSchema(
      studentCollectionId,
      apiKey,
      timestamp
    );
    if (!schema || schema.length === 0)
      console.log(
        `[${timestamp}] Could not fetch student schema; proceeding with defaults`
      );

    const resolved = {
      name: resolveFieldKey(schema, ["name"]),
      schoolName: resolveFieldKey(schema, [
        "school-name",
        "school name",
        "school",
      ]),
      schoolYear: resolveFieldKey(schema, ["school-year", "school year"]),
      campaignTitle: resolveFieldKey(schema, [
        "campaign-title",
        "campaign title",
        "title",
      ]),
      campaignGoal: resolveFieldKey(schema, [
        "campaign-goal",
        "campaign goal",
        "goal",
        "target-amount",
        "target",
      ]),
      campaignPhoto: resolveFieldKey(schema, [
        "campaign-photo",
        "campaign photo",
        "photo",
        "image",
        "cover-image",
      ]),
      studentVideo: resolveFieldKey(schema, [
        "student-video",
        "student video",
        "video",
        "video-url",
        "embed",
      ]),
      letterFromStudent: resolveFieldKey(schema, [
        "letter-from-student",
        "letter from student",
        "letter",
        "story",
      ]),
      profileStatus: resolveFieldKey(schema, [
        "profile-status",
        "profile status",
        "status",
      ]),
      userName: resolveFieldKey(schema, [
        "user-name",
        "user name",
        "username",
        "user",
      ]),
    };
    console.log(`[${timestamp}] Resolved Student field keys:`, resolved);

    // Check if exists
    console.log(
      `[${timestamp}] Checking Student collection for existing user-name: "${userNameFromForm}"`
    );
    const listRes = await fetch(
      `https://api.webflow.com/v2/collections/${studentCollectionId}/items`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "accept-version": "2.0.0",
        },
      }
    );
    if (!listRes.ok) {
      const errText = await listRes.text();
      console.error(
        `[${timestamp}] Failed to list Student items: ${listRes.status} - ${errText}`
      );
      return { created: false, error: errText };
    }
    const listJson = await listRes.json();
    const items = Array.isArray(listJson.items) ? listJson.items : [];
    const userNameKey = resolved.userName;
    const existing = items.find((item) => {
      const val = userNameKey ? item.fieldData?.[userNameKey] : undefined;
      return (
        val &&
        String(val).toLowerCase().trim() ===
          String(userNameFromForm).toLowerCase().trim()
      );
    });
    if (existing) {
      console.log(
        `[${timestamp}] Student record already exists for user-name "${userNameFromForm}" (id: ${existing.id})`
      );
      return {
        created: false,
        reason: "Already exists",
        existingId: existing.id,
      };
    }

    // Build payload
    const firstName = formData["first-name"] || "";
    const lastName = formData["last-name"] || "";
    const fullName =
      [firstName, lastName].filter(Boolean).join(" ").trim() ||
      userNameFromForm;
    const campaignTitle = firstName
      ? `${firstName}'s Education Fund`
      : "Education Fund";
    const goal = toNumberIfPossible(formData["donation-support-amount"]);
    const storyUrl = formData["story-url"] || undefined;
    const storyVideo = formData["story-video"] || undefined;
    const letterFromStudent = formData["funding-need-story"] || "";

    // NEW: enforce max length for letter-from-student based on schema (fallback 500)
    let letterValue = letterFromStudent;
    if (resolved.letterFromStudent) {
      const maxLen = getMaxLengthForField(
        schema,
        resolved.letterFromStudent,
        500
      );
      if (typeof letterValue === "string" && letterValue.length > maxLen) {
        console.log(
          `[${timestamp}] Truncating "${resolved.letterFromStudent}" from ${letterValue.length} to max ${maxLen}`
        );
        letterValue = truncateToMaxLength(letterValue, maxLen);
      }
    }

    // Track original URL for possible text fallback if rehost fails
    let fallbackPhotoUrlText = storyUrl || null;

    // START UPDATED ASSET HANDLING
    let assetFileId = null; // NEW: asset file id variable

    // Rehost image if needed
    let finalCampaignPhotoUrl = null;
    if (storyUrl) {
      const looksLikeFormUpload =
        /formUploads/i.test(storyUrl) || isForbiddenAssetHost(storyUrl);
      if (looksLikeFormUpload && siteId) {
        const rehost = await rehostToWebflowAssets({
          sourceUrl: storyUrl,
          siteId,
          apiKey,
          timestamp,
        });
        if (rehost.ok && rehost.url) {
          finalCampaignPhotoUrl = rehost.url;
          assetFileId = rehost.assetId || null; // Set assetFileId
          console.log(`[${timestamp}] Using rehosted campaign photo URL`);
          // We no longer need the fallback text url if rehost succeeded
          fallbackPhotoUrlText = null;
        } else {
          console.warn(
            `[${timestamp}] Rehost failed (${
              rehost.reason || "unknown"
            }). Will try text fallback field or skip image.`
          );
        }
      } else {
        // Allowed host already
        finalCampaignPhotoUrl = storyUrl;
        // And no need for fallback text
        fallbackPhotoUrlText = null;
      }
    }
    // END UPDATED ASSET HANDLING

    // Build fieldData with resolved keys only if present
    const fieldData = {};
    if (resolved.name) fieldData[resolved.name] = fullName;
    if (resolved.schoolName)
      fieldData[resolved.schoolName] = formData["school"] || "";
    if (resolved.schoolYear)
      fieldData[resolved.schoolYear] = formData["school-year"] || "";
    if (resolved.campaignTitle)
      fieldData[resolved.campaignTitle] = campaignTitle;
    if (resolved.campaignGoal && goal !== undefined)
      fieldData[resolved.campaignGoal] = goal;

    // START UPDATED IMAGE FIELD HANDLING
    // Prefer asset fileId for image fields to avoid remote import issues
    if (resolved.campaignPhoto && assetFileId) {
      fieldData[resolved.campaignPhoto] = { fileId: assetFileId };
    } else if (finalCampaignPhotoUrl) {
      if (
        resolved.campaignPhoto &&
        !isForbiddenAssetHost(finalCampaignPhotoUrl)
      ) {
        fieldData[resolved.campaignPhoto] = finalCampaignPhotoUrl;
      } else {
        // Save to a text field if image field is missing/forbidden
        const photoUrlTextKey = resolveFieldKey(schema, [
          "campaign-photo-url",
          "photo-url",
          "image-url",
          "cover-image-url",
          "campaign-photo-link",
          "photo-link",
          "image-link",
        ]);
        if (photoUrlTextKey) {
          fieldData[photoUrlTextKey] = finalCampaignPhotoUrl;
          console.log(
            `[${timestamp}] Saved image URL to text field "${photoUrlTextKey}" (image field missing/forbidden).`
          );
        }
      }
    } else if (fallbackPhotoUrlText) {
      // Rehost unavailable: still save the original URL in a text field if present
      const photoUrlTextKey = resolveFieldKey(schema, [
        "campaign-photo-url",
        "photo-url",
        "image-url",
        "cover-image-url",
        "campaign-photo-link",
        "photo-link",
        "image-link",
      ]);
      if (photoUrlTextKey) {
        fieldData[photoUrlTextKey] = fallbackPhotoUrlText;
        console.log(
          `[${timestamp}] Rehost unavailable. Saved original URL to text field "${photoUrlTextKey}".`
        );
      } else {
        console.log(
          `[${timestamp}] Rehost unavailable and no photo URL text field found. Proceeding without photo.`
        );
      }
    }
    // END UPDATED IMAGE FIELD HANDLING

    // Optional: store full letter in a separate long-text field if it exists
    if (
      typeof letterFromStudent === "string" &&
      letterFromStudent !== letterValue
    ) {
      const fullLetterKey = resolveFieldKey(schema, [
        "letter-from-student-full",
        "letter-full",
        "story-full",
        "full-letter",
      ]);
      if (fullLetterKey) {
        // Will be included below when assembling fieldData
        fieldData[fullLetterKey] = letterFromStudent;
        console.log(`[${timestamp}] Saved full letter to "${fullLetterKey}"`);
      }
    }

    if (resolved.studentVideo && storyVideo)
      fieldData[resolved.studentVideo] = storyVideo;
    if (resolved.letterFromStudent)
      fieldData[resolved.letterFromStudent] = letterValue;
    if (resolved.profileStatus) fieldData[resolved.profileStatus] = "Draft";
    if (resolved.userName) fieldData[resolved.userName] = userNameFromForm;

    fieldData.slug = `student-${sanitizeSlug(
      userNameFromForm || fullName
    )}-${Date.now()}`;

    const createPayload = {
      items: [
        {
          isArchived: false,
          isDraft: false,
          fieldData,
        },
      ],
    };

    // START UPDATED CREATE POST BLOCK WITH RETRY
    console.log(
      `[${timestamp}] Creating Student record with payload:`,
      JSON.stringify(createPayload, null, 2)
    );
    let createRes = await fetch(
      `https://api.webflow.com/v2/collections/${studentCollectionId}/items`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "accept-version": "2.0.0",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createPayload),
      }
    );

    if (!createRes.ok) {
      const errText = await createRes.text();
      const isUnsupportedType =
        /Unsupported file type|Remote file failed to import/i.test(
          errText || ""
        );

      if (isUnsupportedType) {
        console.warn(
          `[${timestamp}] Image import rejected. Retrying without image field and saving URL to text field.`
        );

        // Strip image field and save URL to a text field if available
        const fd = { ...(createPayload.items[0].fieldData || {}) };
        if (resolved.campaignPhoto && fd[resolved.campaignPhoto]) {
          delete fd[resolved.campaignPhoto];
        }

        const fallbackUrl =
          finalCampaignPhotoUrl || fallbackPhotoUrlText || null;

        if (fallbackUrl) {
          const photoUrlTextKey = resolveFieldKey(schema, [
            "campaign-photo-url",
            "photo-url",
            "image-url",
            "cover-image-url",
            "campaign-photo-link",
            "photo-link",
            "image-link",
          ]);
          if (photoUrlTextKey) {
            fd[photoUrlTextKey] = fallbackUrl;
            console.log(
              `[${timestamp}] Saved image URL to text field "${photoUrlTextKey}" on retry.`
            );
          }
        }

        const retryPayload = {
          items: [
            {
              ...createPayload.items[0],
              fieldData: fd,
            },
          ],
        };

        console.log(
          `[${timestamp}] Retrying Student record creation without image:`,
          JSON.stringify(retryPayload, null, 2)
        );
        createRes = await fetch(
          `https://api.webflow.com/v2/collections/${studentCollectionId}/items`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "accept-version": "2.0.0",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(retryPayload),
          }
        );
      } else {
        console.error(
          `[${timestamp}] Failed to create Student record: ${createRes.status} - ${errText}`
        );
        return { created: false, error: errText, status: createRes.status };
      }
    }

    if (!createRes.ok) {
      const finalErr = await createRes.text();
      console.error(
        `[${timestamp}] Failed to create Student record after retry: ${createRes.status} - ${finalErr}`
      );
      return { created: false, error: finalErr, status: createRes.status };
    }

    const createdJson = await createRes.json();
    const newId = createdJson.items?.[0]?.id;
    console.log(`[${timestamp}] Student record created. ID: ${newId}`);
    // END UPDATED CREATE POST BLOCK WITH RETRY

    let publishResult = { success: false };
    if (newId) {
      publishResult = await publishCmsItems(
        [newId],
        studentCollectionId,
        apiKey,
        timestamp
      );
    }

    return {
      created: true,
      id: newId,
      publishResult,
      data: createdJson,
      resolvedFieldKeys: resolved,
    };
  } catch (e) {
    console.error(
      `[${timestamp}] Error in ensureStudentRecordForUser:`,
      e.message
    );
    return { created: false, error: e.message };
  }
}

// --- Handler ---

export default async function handler(req, res) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Function invoked`);

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return res.status(200).json({
      message: "Multi-form webhook endpoint",
      supportedForms: Object.keys(FORM_CONFIGS).map((formId) => ({
        formId,
        name: FORM_CONFIGS[formId].name,
        requiredFields: FORM_CONFIGS[formId].requiredFields,
      })),
      timestamp,
    });
  }

  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ error: "Method not allowed", expected: "POST", timestamp });
  }

  try {
    const automatedCheck = isAutomatedRequest(req);
    console.log(`[${timestamp}] Request analysis:`, {
      userAgent: automatedCheck.userAgent,
      referer: automatedCheck.referer,
      isBot: automatedCheck.isBot,
      hasNoReferer: automatedCheck.hasNoReferer,
      hasEmptyBody: automatedCheck.hasEmptyBody,
      isLikelyAutomated: automatedCheck.isLikelyAutomated,
      ip:
        req.headers["x-forwarded-for"] ||
        req.connection?.remoteAddress ||
        "unknown",
      method: req.method,
      contentType: req.headers["content-type"] || "none",
    });
    if (automatedCheck.isLikelyAutomated) {
      console.log(
        `[${timestamp}] AUTOMATED REQUEST DETECTED - Returning early to avoid spam`
      );
      return res.status(200).json({
        message: "Webhook endpoint is healthy",
        timestamp,
        note: "Automated request",
      });
    }

    console.log(
      `[${timestamp}] Raw request body:`,
      JSON.stringify(req.body, null, 2)
    );

    // Extract Webflow webhook data
    let formData = null;
    let formId = null;
    let siteId = null;
    try {
      if (req.body?.triggerType === "form_submission" && req.body?.payload) {
        formData = req.body.payload.data;
        formId = req.body.payload.formId;
        siteId = req.body.payload.siteId || null;
        console.log(`[${timestamp}] Webflow form submission detected`);
      } else {
        console.log(
          `[${timestamp}] Invalid webhook format - not a Webflow form submission`
        );
        return res.status(400).json({
          error: "Invalid webhook format",
          expected: "Webflow form submission webhook",
          received: {
            triggerType: req.body?.triggerType,
            hasPayload: !!req.body?.payload,
          },
          timestamp,
        });
      }
    } catch (extractionError) {
      console.error(
        `[${timestamp}] Error extracting webhook data:`,
        extractionError.message
      );
      return res.status(400).json({
        error: "Failed to extract webhook data",
        details: extractionError.message,
        timestamp,
      });
    }

    console.log(`[${timestamp}] Form ID: ${formId}`);
    console.log(`[${timestamp}] Form data:`, JSON.stringify(formData, null, 2));

    // Debug fields
    console.log(`[${timestamp}] === FORM FIELD DEBUGGING ===`);
    Object.keys(formData).forEach((key, index) => {
      console.log(
        `[${timestamp}]   ${index + 1}. "${key}" = "${formData[key]}"`
      );
    });
    console.log(`[${timestamp}] === END FORM FIELD DEBUGGING ===`);

    // Get form config
    const formConfig = FORM_CONFIGS[formId];
    if (!formConfig) {
      console.log(`[${timestamp}] Unknown form ID: ${formId}`);
      return res.status(400).json({
        error: "Unknown form ID",
        formId,
        supportedForms: Object.keys(FORM_CONFIGS),
        availableFormFields: Object.keys(formData),
        timestamp,
      });
    }

    // Env checks
    if (!process.env.WEBFLOW_API_KEY) {
      console.error(`[${timestamp}] Missing WEBFLOW_API_KEY`);
      return res.status(500).json({
        error: "Missing WEBFLOW_API_KEY environment variable",
        timestamp,
      });
    }
    if (!formConfig.collectionId) {
      console.error(
        `[${timestamp}] Missing collection ID for form: ${formConfig.name}`
      );
      return res.status(500).json({
        error: `Missing collection ID for form: ${formConfig.name}`,
        timestamp,
      });
    }

    // Extract and map fields
    const extractedData = {};
    const missingRequired = [];
    const skippedFields = [];

    try {
      for (const [webflowField, cmsField] of Object.entries(
        formConfig.fieldMapping
      )) {
        const value = formData[webflowField];
        console.log(
          `[${timestamp}] Processing field: ${webflowField} -> ${cmsField} with value: "${value}"`
        );

        if (value !== undefined && value !== null && value !== "") {
          if (
            formConfig.referenceFields &&
            formConfig.referenceFields[cmsField]
          ) {
            const referenceConfig = formConfig.referenceFields[cmsField];
            if (!referenceConfig.collectionId) {
              if (referenceConfig.fallbackToText)
                extractedData[cmsField] = value;
              else {
                skippedFields.push(`${cmsField} (no collection ID)`);
                continue;
              }
            } else {
              const referenceResult = await lookupReferenceItem(
                value,
                referenceConfig,
                process.env.WEBFLOW_API_KEY,
                timestamp
              );
              if (referenceResult && referenceResult.id) {
                extractedData[cmsField] = referenceResult.id;
              } else if (referenceConfig.fallbackToText) {
                extractedData[cmsField] = value;
              } else {
                skippedFields.push(`${cmsField} (no match for "${value}")`);
                continue;
              }
            }
          } else {
            extractedData[cmsField] = value;
          }
        }

        if (
          formConfig.requiredFields.includes(webflowField) &&
          (!value || String(value).trim() === "")
        ) {
          missingRequired.push(webflowField);
        }
      }

      // Apply status override
      if (formConfig.statusOverride && formConfig.statusOverride.enabled) {
        const statusValue =
          typeof formConfig.statusOverride.getValue === "function"
            ? formConfig.statusOverride.getValue(formData)
            : formConfig.statusOverride.value;
        extractedData[formConfig.statusOverride.field] = statusValue;
        console.log(
          `[${timestamp}] STATUS OVERRIDE -> ${formConfig.statusOverride.field}: "${statusValue}"`
        );
      }

      // Unmapped fields debug
      const mappedFields = Object.keys(formConfig.fieldMapping);
      const unmappedFields = Object.keys(formData).filter(
        (f) => !mappedFields.includes(f)
      );
      if (unmappedFields.length > 0) {
        console.log(`[${timestamp}] === UNMAPPED FIELDS ===`);
        unmappedFields.forEach((f, i) =>
          console.log(`[${timestamp}]   ${i + 1}. "${f}" = "${formData[f]}"`)
        );
        console.log(`[${timestamp}] === END UNMAPPED FIELDS ===`);
      }
    } catch (mappingError) {
      console.error(
        `[${timestamp}] Error mapping fields:`,
        mappingError.message
      );
      return res.status(500).json({
        error: "Failed to map form fields",
        details: mappingError.message,
        timestamp,
      });
    }

    if (missingRequired.length > 0) {
      console.log(`[${timestamp}] Missing required fields:`, missingRequired);
      return res.status(400).json({
        error: "Missing required fields",
        missingFields: missingRequired,
        requiredFields: formConfig.requiredFields,
        receivedFields: Object.keys(formData),
        timestamp,
      });
    }

    // Slug and name
    let slug;
    try {
      slug = formConfig.generateSlug(formData);
      console.log(`[${timestamp}] Generated slug: ${slug}`);
    } catch {
      slug = `submission-${Date.now()}`;
    }
    if (!extractedData.name) {
      const firstValue =
        Object.values(extractedData)[0] || `Submission ${Date.now()}`;
      extractedData.name = firstValue;
      console.log(`[${timestamp}] Generated name field: ${extractedData.name}`);
    }

    // Create or update Application
    let existingRecord = null;
    let isUpdate = false;
    if (formConfig.updateExistingRecord?.enabled && extractedData.name) {
      existingRecord = await checkForExistingRecord(
        extractedData.name,
        formConfig.updateExistingRecord,
        formConfig.collectionId,
        process.env.WEBFLOW_API_KEY,
        timestamp
      );
      isUpdate = !!(existingRecord && existingRecord.canUpdate);
    }

    let payload;
    let webflowResponse;
    if (isUpdate && existingRecord) {
      payload = {
        items: [
          {
            id: existingRecord.id,
            isArchived: false,
            isDraft: false,
            fieldData: {
              ...existingRecord.item.fieldData,
              ...extractedData,
              slug: existingRecord.item.fieldData.slug || slug,
            },
          },
        ],
      };
      console.log(
        `[${timestamp}] UPDATE payload:`,
        JSON.stringify(payload, null, 2)
      );
      webflowResponse = await fetch(
        `https://api.webflow.com/v2/collections/${formConfig.collectionId}/items`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${process.env.WEBFLOW_API_KEY}`,
            "accept-version": "2.0.0",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );
    } else {
      payload = {
        items: [
          {
            isArchived: false,
            isDraft: false,
            fieldData: { ...extractedData, slug },
          },
        ],
      };
      console.log(
        `[${timestamp}] CREATE payload:`,
        JSON.stringify(payload, null, 2)
      );
      webflowResponse = await fetch(
        `https://api.webflow.com/v2/collections/${formConfig.collectionId}/items`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.WEBFLOW_API_KEY}`,
            "accept-version": "2.0.0",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );
    }

    console.log(
      `[${timestamp}] Webflow API response status:`,
      webflowResponse.status
    );
    if (!webflowResponse.ok) {
      const errorData = await webflowResponse.text();
      console.error(`[${timestamp}] Webflow API error:`, errorData);
      return res.status(webflowResponse.status).json({
        error: `Failed to ${isUpdate ? "update" : "create"} CMS item`,
        formName: formConfig.name,
        collectionId: formConfig.collectionId,
        details: errorData,
        extractedData,
        isUpdate,
        existingRecordId: existingRecord?.id,
        timestamp,
      });
    }

    const responseData = await webflowResponse.json();
    console.log(
      `[${timestamp}] CMS item ${isUpdate ? "updated" : "created"} successfully`
    );
    const itemId = isUpdate ? existingRecord.id : responseData.items?.[0]?.id;

    // Publish Application now
    let publishResult = { success: false };
    if (itemId) {
      publishResult = await publishCmsItems(
        [itemId],
        formConfig.collectionId,
        process.env.WEBFLOW_API_KEY,
        timestamp
      );
    }

    // If General Application is Submitted, ensure Student record exists
    let studentCreationResult = { created: false };
    if (
      formId === "682602bb5760376d719623dc" &&
      formConfig.createStudentOnSubmit?.enabled &&
      String(extractedData["application-status"] || "").toLowerCase() ===
        "submitted"
    ) {
      console.log(
        `[${timestamp}] Application status is Submitted -> ensuring Student record`
      );
      studentCreationResult = await ensureStudentRecordForUser({
        formData,
        studentCollectionId:
          formConfig.createStudentOnSubmit.studentCollectionId,
        siteId,
        apiKey: process.env.WEBFLOW_API_KEY,
        timestamp,
      });
      if (studentCreationResult.created) {
        console.log(
          `[${timestamp}] Student record created: ${studentCreationResult.id}`
        );
      } else {
        console.log(
          `[${timestamp}] Student record not created: ${
            studentCreationResult.reason ||
            studentCreationResult.error ||
            "unknown"
          }`
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: `${formConfig.name} submission processed successfully`,
      action: isUpdate ? "updated" : "created",
      status: extractedData["application-status"],
      formId,
      formName: formConfig.name,
      data: responseData,
      extractedFields: extractedData,
      skippedFields,
      publishResult,
      itemId,
      isUpdate,
      existingRecordId: existingRecord?.id,
      studentCreationResult,
      timestamp,
    });
  } catch (error) {
    console.error(`[${timestamp}] Unexpected error:`, error.message);
    console.error(`[${timestamp}] Error stack:`, error.stack);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
      stack: error.stack,
      timestamp,
    });
  }
}
