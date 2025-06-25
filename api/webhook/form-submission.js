// Form configuration mapping - Add your forms here
const FORM_CONFIGS = {
  /// Crowd Funding Donor comments form
  "6852c7791d84f17a29ace6f0": {
    name: "Student Crowd Funding Donor Comments",
    collectionId: process.env.WEBFLOW_DONOR_COMMENTS_COLLECTION_ID,
    fieldMapping: {
      DonorName: "name",
      DonorMessage: "donor-message",
      StudentProfile: "student-profile",
    },
    requiredFields: ["DonorName"], // Fixed: was "Name", should be "DonorName"
    generateSlug: (data) => {
      try {
        const donorName = data.DonorName || "donor";
        return `donor-${donorName
          .toLowerCase()
          .replace(/\s+/g, "-")}-${Date.now()}`;
      } catch (error) {
        return `donor-submission-${Date.now()}`;
      }
    },
    generateMessageDateTime: () => new Date().toISOString(),
  },
};

export default async function handler(req, res) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Function invoked`);

  // Add CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

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
    return res.status(405).json({
      error: "Method not allowed",
      expected: "POST",
      timestamp,
    });
  }

  try {
    console.log(
      `[${timestamp}] Raw request body:`,
      JSON.stringify(req.body, null, 2)
    );

    // Extract form data from Webflow webhook
    let formData = null;
    let formId = null;
    let webhookInfo = null;

    try {
      if (req.body?.triggerType === "form_submission" && req.body?.payload) {
        formData = req.body.payload.data;
        formId = req.body.payload.formId;
        webhookInfo = {
          siteId: req.body.payload.siteId || "unknown",
          submittedAt: req.body.payload.submittedAt || new Date().toISOString(),
          pageId: req.body.payload.pageId || "unknown",
          publishedPath: req.body.payload.publishedPath || "/unknown",
        };
        console.log(`[${timestamp}] Webflow form submission detected`);
      } else {
        console.log(`[${timestamp}] Invalid webhook format`);
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

    // Get form configuration
    const formConfig = FORM_CONFIGS[formId];
    if (!formConfig) {
      console.log(`[${timestamp}] Unknown form ID: ${formId}`);
      return res.status(400).json({
        error: "Unknown form ID",
        formId,
        supportedForms: Object.keys(FORM_CONFIGS),
        timestamp,
      });
    }

    console.log(`[${timestamp}] Processing form: ${formConfig.name}`);

    // Validate required environment variables
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
        requiredEnvVar: "WEBFLOW_DONOR_COMMENTS_COLLECTION_ID",
        availableEnvVars: {
          WEBFLOW_API_KEY: !!process.env.WEBFLOW_API_KEY,
          WEBFLOW_DONOR_COMMENTS_COLLECTION_ID:
            !!process.env.WEBFLOW_DONOR_COMMENTS_COLLECTION_ID,
        },
        timestamp,
      });
    }

    console.log(
      `[${timestamp}] Using collection ID: ${formConfig.collectionId}`
    );

    // Extract and map form fields
    const extractedData = {};
    const missingRequired = [];

    try {
      // Map form fields according to configuration
      Object.entries(formConfig.fieldMapping).forEach(
        ([webflowField, cmsField]) => {
          const value = formData[webflowField];
          if (value !== undefined && value !== null && value !== "") {
            extractedData[cmsField] = value;
          }

          // Check required fields
          if (
            formConfig.requiredFields.includes(webflowField) &&
            (!value || value.trim() === "")
          ) {
            missingRequired.push(webflowField);
          }
        }
      );

      console.log(`[${timestamp}] Extracted data:`, extractedData);
      console.log(`[${timestamp}] All available fields in form data:`);
      Object.keys(formData).forEach((key) => {
        console.log(`  - ${key}: ${formData[key]}`);
      });
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

    // Validate required fields
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

    // Generate slug using form-specific logic
    let slug;
    try {
      slug = formConfig.generateSlug(formData);
      console.log(`[${timestamp}] Generated slug: ${slug}`);
    } catch (slugError) {
      console.error(`[${timestamp}] Error generating slug:`, slugError.message);
      slug = `submission-${Date.now()}`;
    }

    // Generate message date & time using form-specific logic
    let messageDateTime;
    try {
      messageDateTime = formConfig.generateMessageDateTime(formData);
      console.log(
        `[${timestamp}] Generated message date time: ${messageDateTime}`
      );
    } catch (dateError) {
      console.error(
        `[${timestamp}] Error generating message date time:`,
        dateError.message
      );
      messageDateTime = new Date().toISOString();
    }

    // Ensure 'name' field exists (required by Webflow API)
    if (!extractedData.name) {
      // Try to use the first available field as name, or generate one
      const firstValue =
        Object.values(extractedData)[0] || `Submission ${Date.now()}`;
      extractedData.name = firstValue;
      console.log(`[${timestamp}] Generated name field: ${extractedData.name}`);
    }

    // Create CMS payload
    const payload = {
      items: [
        {
          isArchived: false,
          isDraft: false,
          fieldData: {
            ...extractedData,
            slug: slug,
          },
        },
      ],
    };

    console.log(
      `[${timestamp}] CMS payload:`,
      JSON.stringify(payload, null, 2)
    );

    // Send to Webflow CMS
    try {
      console.log(`[${timestamp}] Making request to Webflow API...`);
      const webflowResponse = await fetch(
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

      console.log(
        `[${timestamp}] Webflow API response status:`,
        webflowResponse.status
      );

      if (!webflowResponse.ok) {
        const errorData = await webflowResponse.text();
        console.error(`[${timestamp}] Webflow API error:`, errorData);

        return res.status(webflowResponse.status).json({
          error: "Failed to create CMS item",
          formName: formConfig.name,
          collectionId: formConfig.collectionId,
          details: errorData,
          timestamp,
        });
      }

      const responseData = await webflowResponse.json();
      console.log(`[${timestamp}] CMS item created successfully`);

      res.status(200).json({
        success: true,
        message: `${formConfig.name} submission processed successfully`,
        formId,
        formName: formConfig.name,
        data: responseData,
        extractedFields: extractedData,
        timestamp,
      });
    } catch (apiError) {
      console.error(
        `[${timestamp}] Error calling Webflow API:`,
        apiError.message
      );
      return res.status(500).json({
        error: "Failed to call Webflow API",
        details: apiError.message,
        timestamp,
      });
    }
  } catch (error) {
    console.error(`[${timestamp}] Unexpected error:`, error.message);
    console.error(`[${timestamp}] Error stack:`, error.stack);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
      stack: error.stack,
      timestamp,
    });
  }
}
