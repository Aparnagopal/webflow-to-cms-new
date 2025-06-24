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
    // Log the entire request body for debugging
    console.log(
      `[${timestamp}] Raw request body:`,
      JSON.stringify(req.body, null, 2)
    );

    // Extract form data from Webflow webhook structure
    let formData = null;

    // Check for Webflow form submission structure
    if (
      req.body &&
      req.body.triggerType === "form_submission" &&
      req.body.payload &&
      req.body.payload.data
    ) {
      console.log(`[${timestamp}] Detected Webflow form submission webhook`);
      formData = req.body.payload.data;
    }
    // Fallback: Check for direct payload.data structure
    else if (req.body && req.body.payload && req.body.payload.data) {
      console.log(`[${timestamp}] Using req.body.payload.data as form data`);
      formData = req.body.payload.data;
    }
    // Fallback: Direct form data in body
    else if (
      req.body &&
      typeof req.body === "object" &&
      !req.body.triggerType
    ) {
      console.log(`[${timestamp}] Using direct body as form data`);
      formData = req.body;
    }

    console.log(
      `[${timestamp}] Extracted form data:`,
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

    // Extract fields directly from the form data
    const { Name, SchoolName, City, Country } = formData;

    // Log extracted fields
    console.log(`[${timestamp}] Extracted fields:`, {
      Name,
      SchoolName,
      City,
      Country,
    });

    // Log all available fields in the form data for debugging
    console.log(`[${timestamp}] All available fields in form data:`);
    Object.keys(formData).forEach((key) => {
      console.log(`  - ${key}: ${formData[key]}`);
    });

    // Validate required environment variables
    if (!process.env.WEBFLOW_API_KEY || !process.env.WEBFLOW_COLLECTION_ID) {
      console.error(`[${timestamp}] Missing required environment variables`);
      return res.status(500).json({
        error: "Server configuration error",
        timestamp: timestamp,
      });
    }

    // Validate that we have at least some form data
    if (!Name && !SchoolName && !City && !Country) {
      return res.status(400).json({
        error: "No form fields found",
        availableFields: Object.keys(formData),
        receivedData: formData,
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
            schoolname: SchoolName,
            city: City,
            country: Country,
          },
        },
      ],
    };

    console.log(
      `[${timestamp}] Payload being sent to Webflow:`,
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

      return res.status(webflowResponse.status).json({
        error: "Failed to create CMS item",
        details: errorData,
        webflowStatus: webflowResponse.status,
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
      message: "Form submission processed successfully",
      data: responseData,
      extractedFields: { Name, SchoolName, City, Country },
      submissionInfo: {
        formId: req.body.payload?.formId,
        submittedAt: req.body.payload?.submittedAt,
        siteId: req.body.payload?.siteId,
      },
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
