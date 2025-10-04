/**
 * Script: Print the current Student collection schema (field API keys) so we can align mapping precisely.
 * Usage:
 *   1) Set environment variables:
 *        export WEBFLOW_API_KEY="..."
 *        export WEBFLOW_STUDENTSCRFD_COLLECTION_ID="..."
 *   2) Run:
 *        node scripts/get-student-schema.mjs
 */

async function main() {
  const apiKey = process.env.WEBFLOW_API_KEY;
  const collectionId = process.env.WEBFLOW_STUDENTSCRFD_COLLECTION_ID;
  const timestamp = new Date().toISOString();

  if (!apiKey || !collectionId) {
    console.error(
      "Missing WEBFLOW_API_KEY or WEBFLOW_STUDENTSCRFD_COLLECTION_ID"
    );
    process.exit(1);
  }

  async function fetchCollectionSchema(collectionId) {
    // Primary
    const url = `https://api.webflow.com/v2/collections/${collectionId}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, "accept-version": "2.0.0" },
    });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.fields) && json.fields.length > 0)
        return json.fields;
    } else {
      console.warn(
        "Primary schema request failed:",
        res.status,
        await res.text()
      );
    }

    // Fallback
    const url2 = `https://api.webflow.com/v2/collections/${collectionId}/fields`;
    const res2 = await fetch(url2, {
      headers: { Authorization: `Bearer ${apiKey}`, "accept-version": "2.0.0" },
    });
    if (res2.ok) {
      const json2 = await res2.json();
      return json2.fields || json2.items || [];
    } else {
      console.warn(
        "Fallback schema request failed:",
        res2.status,
        await res2.text()
      );
    }
    return [];
  }

  try {
    console.log(
      `[${timestamp}] Fetching schema for collection: ${collectionId}`
    );
    const fields = await fetchCollectionSchema(collectionId);
    console.log(`[${timestamp}] Fields (${fields.length}):`);
    for (const f of fields) {
      console.log(
        JSON.stringify(
          {
            id: f.id,
            key: f.key || undefined,
            slug: f.slug || undefined,
            name: f.name || f.displayName || f.label,
            type: f.type,
            required: f.required,
          },
          null,
          2
        )
      );
    }
    console.log(
      "\nCopy the 'slug' (or 'key') values to verify/adjust the runtime mapping if needed."
    );
  } catch (e) {
    console.error("Error fetching schema:", e);
    process.exit(1);
  }
}

main();
