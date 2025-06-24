export default async function handler(req, res) {
  // Add timestamp for debugging
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Function invoked`);

  // Add CORS headers for cross-origin requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    console.log(`[${timestamp}] OPTIONS request handled`);
    return res.status(200).end();
  }

  // Log all request details for debugging
  console.log(`[${timestamp}] Request method:`, req.method);
  console.log(
    `[${timestamp}] Request body:`,
    JSON.stringify(req.body, null, 2)
  );

  // Handle GET requests for testing
  if (req.method === "GET") {
    return res.status(200).json({
      message: "Webhook endpoint is working",
      method: req.method,
      timestamp: timestamp,
      note: "This endpoint expects POST requests from Webflow",
    });
  }

  // Only allow POST requests for actual webhook
  if (req.method !== "POST") {
    console.log(`[${timestamp}] Method not allowed:`, req.method);
    return res.status(405).json({
      error: "Method not allowed",
      received: req.method,
      expected: "POST",
      timestamp: timestamp,
    });
  }

  try {
    // Handle different payload formats from Webflow
    let formData = req.body;

    // Webflow sometimes sends data in a 'data' property
    if (req.body && req.body.data) {
      formData = req.body.data;
    }

    console.log(
      `[${timestamp}] Processed form data:`,
      JSON.stringify(formData, null, 2)
    );

    if (!formData || Object.keys(formData).length === 0) {
      console.log(`[${timestamp}] No form data received`);
      return res.status(400).json({
        error: "No form data received",
        receivedBody: req.body,
        timestamp: timestamp,
      });
    }

    const { Name, SchoolName, City, Country } = formData;

    // Log extracted fields
    console.log(`[${timestamp}] Extracted fields:`, {
      Name,
      SchoolName,
      City,
      Country,
    });

    // Validate required environment variables
    if (!process.env.WEBFLOW_API_KEY || !process.env.WEBFLOW_COLLECTION_ID) {
      console.error(`[${timestamp}] Missing required environment variables`);
      console.error(
        `[${timestamp}] API Key exists:`,
        !!process.env.WEBFLOW_API_KEY
      );
      console.error(
        `[${timestamp}] Collection ID exists:`,
        !!process.env.WEBFLOW_COLLECTION_ID
      );
      return res.status(500).json({
        error: "Server configuration error",
        timestamp: timestamp,
      });
    }

    // Log API key format for debugging (first 10 chars only for security)
    console.log(
      `[${timestamp}] API Key format:`,
      process.env.WEBFLOW_API_KEY.substring(0, 10) + "..."
    );
    console.log(
      `[${timestamp}] Collection ID:`,
      process.env.WEBFLOW_COLLECTION_ID
    );

    console.log(`[${timestamp}] Making request to Webflow API...`);

    // Create CMS item via Webflow API using fetch
    const webflowResponse = await fetch(
      `https://api.webflow.com/v2/collections/${process.env.WEBFLOW_COLLECTION_ID}/items`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WEBFLOW_API_KEY}`,
          "accept-version": "2.0.0",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isArchived: false,
          isDraft: false,
          fieldData: {
            Name,
            Slug: `submission-${Date.now()}`,
            SchoolName,
            City,
            Country,
          },
        }),
      }
    );

    console.log(
      `[${timestamp}] Webflow API response status:`,
      webflowResponse.status
    );

    if (!webflowResponse.ok) {
      const errorData = await webflowResponse.text();
      console.error(
        `[${timestamp}] Webflow API error:`,
        webflowResponse.status,
        errorData
      );

      // Special handling for 401 errors
      if (webflowResponse.status === 401) {
        return res.status(401).json({
          error: "Webflow API authentication failed",
          details: "Please check your API key and permissions",
          troubleshooting: {
            steps: [
              "1. Verify your API key in Webflow dashboard",
              "2. Ensure API key has CMS write permissions",
              "3. Check if API key is expired",
              "4. Verify collection ID is correct",
            ],
          },
          timestamp: timestamp,
        });
      }

      return res.status(webflowResponse.status).json({
        error: "Failed to create CMS item",
        details: errorData,
        timestamp: timestamp,
      });
    }

    const responseData = await webflowResponse.json();
    console.log(
      `[${timestamp}] CMS item created successfully:`,
      JSON.stringify(responseData, null, 2)
    );

    res.status(200).json({
      success: true,
      data: responseData,
      timestamp: timestamp,
    });
  } catch (error) {
    console.error(`[${timestamp}] Error creating CMS item:`, error.message);
    console.error(`[${timestamp}] Error stack:`, error.stack);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
      timestamp: timestamp,
    });
  }
}
