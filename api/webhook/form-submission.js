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
    requiredFields: ["Name"],
    generateSlug: (data) =>
      `school-${data.Name?.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
    generateMessageDateTime: (data) => `${Date.now()}`,
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

    if (req.body?.triggerType === "form_submission" && req.body?.payload) {
      formData = req.body.payload.data;
      formId = req.body.payload.formId;
      webhookInfo = {
        siteId: req.body.payload.siteId,
        submittedAt: req.body.payload.submittedAt,
        pageId: req.body.payload.pageId,
        publishedPath: req.body.payload.publishedPath,
      };
      console.log(`[${timestamp}] Webflow form submission detected`);
    } else {
      return res.status(400).json({
        error: "Invalid webhook format",
        expected: "Webflow form submission webhook",
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
      return res.status(500).json({
        error: "Missing WEBFLOW_API_KEY environment variable",
        timestamp,
      });
    }

    if (!formConfig.collectionId) {
      return res.status(500).json({
        error: `Missing collection ID for form: ${formConfig.name}`,
        requiredEnvVar: `WEBFLOW_${formConfig.name
          .toUpperCase()
          .replace(/\s+/g, "_")}_COLLECTION_ID`,
        timestamp,
      });
    }

    // Extract and map form fields
    const extractedData = {};
    const missingRequired = [];

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

    // Validate required fields
    if (missingRequired.length > 0) {
      return res.status(400).json({
        error: "Missing required fields",
        missingFields: missingRequired,
        requiredFields: formConfig.requiredFields,
        receivedFields: Object.keys(formData),
        timestamp,
      });
    }

    // Generate slug using form-specific logic
    const slug = formConfig.generateSlug(formData);

    // Generate message date & time using form-specific logic
    const message_date_time = formConfig.generateMessageDateTime(formData);

    // Ensure 'name' field exists (required by Webflow API)
    if (!extractedData.name) {
      // Try to use the first available field as name, or generate one
      const firstValue =
        Object.values(extractedData)[0] || `Submission ${Date.now()}`;
      extractedData.name = firstValue;
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
            message_date_time: message - date - time,
            "submitted-at": webhookInfo.submittedAt,
            "form-id": formId,
            "page-path": webhookInfo.publishedPath,
          },
        },
      ],
    };

    console.log(
      `[${timestamp}] CMS payload:`,
      JSON.stringify(payload, null, 2)
    );

    // Send to Webflow CMS
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
  } catch (error) {
    console.error(`[${timestamp}] Error:`, error.message);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
      timestamp,
    });
  }
}
