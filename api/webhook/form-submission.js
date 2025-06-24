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

    // Try different field name variations that Webflow might use
    const extractField = (obj, possibleNames) => {
      for (const name of possibleNames) {
        if (obj[name] !== undefined && obj[name] !== null && obj[name] !== "") {
          return obj[name];
        }
      }
      return null;
    };

    // Extract fields with multiple possible names
    const Name = extractField(formData, ["Name", "name"]);
    const SchoolName = extractField(formData, ["SchoolName", "schoolName"]);
    const City = extractField(formData, ["City", "city"]);
    const Country = extractField(formData, ["Country", "country"]);

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
      return res.status(500).json({
        error: "Server configuration error",
        timestamp: timestamp,
      });
    }

    console.log(`[${timestamp}] Making request to Webflow API...`);

    // Create the payload according to Webflow API v2 specification
    const payload = {
      items: [
        {
          isArchived: false,
          isDraft: false,
          fieldData: {
            name: Name || `Submission ${Date.now()}`, // 'name' is required by Webflow API
            slug: `submission-${Date.now()}`,
            "school-name": SchoolName, // Use kebab-case for field names
            city: City,
            country: Country,
          },
        },
      ],
    };

    console.log(
      `[${timestamp}] Payload being sent:`,
      JSON.stringify(payload, null, 2)
    );

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
        body: JSON.stringify(payload),
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

      // Special handling for validation errors
      if (webflowResponse.status === 400) {
        return res.status(400).json({
          error: "Webflow API validation error",
          details: errorData,
          troubleshooting: {
            steps: [
              "1. Check that your CMS collection has the required fields",
              "2. Verify field names match your CMS collection (use kebab-case)",
              "3. Ensure 'name' field exists in your collection",
              "4. Check that all required fields are provided",
            ],
            sentPayload: payload,
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
