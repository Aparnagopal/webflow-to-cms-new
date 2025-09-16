// Form configuration mapping - Add your forms here
const FORM_CONFIGS = {
  /// Crowd Funding Donor comments form
  "6852c7791d84f17a29ace6f0": {
    name: "Student Crowd Funding Donor Comments",
    collectionId: process.env.WEBFLOW_DONOR_COMMENTS_COLLECTION_ID,
    fieldMapping: {
      DonorName: "name",
      DonorMessage: "donor-message",
      StudentProfile: "student-profile", // This is a reference field
    },
    requiredFields: ["DonorName"],
    referenceFields: {
      // Define reference field configurations
      "student-profile": {
        collectionId: process.env.WEBFLOW_STUDENTSCRFD_COLLECTION_ID, // Collection being referenced
        lookupField: "name", // Field to search by in the referenced collection
        createIfNotFound: false, // Whether to create new items if not found
        fallbackToText: true, // If true, use text value when reference lookup fails
      },
    },
    // Configuration for updating student records with multi-reference
    updateStudentRecord: {
      enabled: true,
      collectionId: process.env.WEBFLOW_STUDENTSCRFD_COLLECTION_ID,
      lookupField: "name", // Field to find the student by
      updateField: "donor-message", // Multi-reference field to update in student record (note: hyphen, not underscore)
      isMultiReference: true, // This is a multi-reference field
    },
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

  /// General Applications form - CORRECTED FIELD MAPPING
  "682602bb5760376d719623dc": {
    name: "General Applications",
    collectionId: process.env.WEBFLOW_GENRLAPPL_COLLECTION_ID,
    fieldMapping: {
      // CORRECTED: Use actual form field names from Webflow (left side = what Webflow sends)
      "first-name": "first-name",
      "last-name": "last-name",
      email: "email",
      phone: "phone",
      "user-name": "name", // This is the lookup field for existing records
      "date-of-birth": "date-of-birth", // Date field from Webflow
      school: "school",
      "school-year": "school-year",
      degree: "degree",
      major: "major",
      "anticipated-graduation-date": "anticipated-graduation-date", // Date field from Webflow
      "full-time": "full-time",
      "required-credits": "required-credits",
      "remaining-credits": "remaining-credits",
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
      "disclosure-signed-date": "disclosure-signed-date", // Date field from Webflow
      "terms-acceptance-check": "terms-acceptance-check",
      "form-signed-name": "form-signed-name",
      "form-signed-date": "form-signed-date", // Date field from Webflow
    },
    requiredFields: ["first-name", "last-name", "email"], // CORRECTED: Use actual form field names
    referenceFields: {},
    // Configuration for checking and updating existing records
    updateExistingRecord: {
      enabled: true,
      lookupField: "name", // Field to search by (maps to user-name)
      statusField: "application-status", // Field to check status
      statusValue: "Draft", // Only update records with this status
    },
    // UPDATED: Dynamic status override based on button clicked
    statusOverride: {
      enabled: true,
      field: "application-status",
      // Function to determine status based on form data
      getValue: (formData) => {
        // Check for button action indicator
        const formAction = formData["form-action"];

        console.log(`Detected form action: "${formAction}"`);

        // Determine status based on button clicked
        if (formAction === "save") {
          return "Draft";
        } else if (formAction === "submit") {
          return "Submitted";
        }

        // Default fallback logic - you can customize this
        // If no action detected, assume it's a save (Draft) unless certain conditions are met
        const hasRequiredSignatures =
          formData["disclosure-signed-name"] && formData["form-signed-name"];
        const hasAcceptedTerms = formData["terms-acceptance-check"] === "true";
        const hasAffirmation = formData["affirmation-check"] === "true";

        // If all final requirements are met, assume it's a submit
        if (hasRequiredSignatures && hasAcceptedTerms && hasAffirmation) {
          console.log(
            "No explicit action detected, but all final requirements met - assuming Submit"
          );
          return "Submitted";
        } else {
          console.log("No explicit action detected, assuming Save (Draft)");
          return "Draft";
        }
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
      } catch (error) {
        return `application-${Date.now()}`;
      }
    },
    addAutomaticFields: false,
  },
};

// Function to detect if request is from a bot or automated system
function isAutomatedRequest(req) {
  const userAgent = req.headers["user-agent"] || "";
  const referer = req.headers["referer"] || "";

  // Common bot/crawler user agents
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

  // Check if user agent matches bot patterns
  const isBot = botPatterns.some((pattern) => pattern.test(userAgent));

  // Check if request has no referer (common for automated requests)
  const hasNoReferer = !referer;

  // Check if request body is empty or malformed
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

// Function to lookup reference items
async function lookupReferenceItem(value, referenceConfig, apiKey, timestamp) {
  try {
    console.log(
      `[${timestamp}] Looking up reference item: "${value}" in collection: ${referenceConfig.collectionId}`
    );

    if (!referenceConfig.collectionId) {
      console.log(
        `[${timestamp}] No collection ID provided for reference lookup`
      );
      return null;
    }

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

    console.log(
      `[${timestamp}] Found ${items.length} items in reference collection`
    );
    console.log(
      `[${timestamp}] Looking for item with ${referenceConfig.lookupField} = "${value}"`
    );

    // Look for item with matching name (case-insensitive)
    const matchingItem = items.find((item) => {
      const itemValue = item.fieldData[referenceConfig.lookupField];
      if (!itemValue) return false;
      return itemValue.toLowerCase().trim() === value.toLowerCase().trim();
    });

    if (matchingItem) {
      console.log(
        `[${timestamp}] Found matching reference item: ${matchingItem.id} for "${value}"`
      );
      return { id: matchingItem.id, item: matchingItem };
    }

    console.log(
      `[${timestamp}] No matching reference item found for: "${value}"`
    );
    return null;
  } catch (error) {
    console.error(
      `[${timestamp}] Error looking up reference item:`,
      error.message
    );
    return null;
  }
}

// NEW FUNCTION: Check for existing record that can be updated
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

    if (!updateConfig.enabled) {
      console.log(`[${timestamp}] Update existing record not enabled`);
      return null;
    }

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

    console.log(`[${timestamp}] Found ${items.length} items in collection`);

    // Look for item with matching name and Draft status
    const existingItem = items.find((item) => {
      const nameValue = item.fieldData[updateConfig.lookupField];
      const statusValue = item.fieldData[updateConfig.statusField];

      if (!nameValue) return false;

      const nameMatch =
        nameValue.toLowerCase().trim() === userName.toLowerCase().trim();
      const statusMatch =
        statusValue &&
        statusValue.toLowerCase().trim() ===
          updateConfig.statusValue.toLowerCase().trim();

      console.log(
        `[${timestamp}] Checking item ${item.id}: name="${nameValue}" (match: ${nameMatch}), status="${statusValue}" (match: ${statusMatch})`
      );

      return nameMatch && statusMatch;
    });

    if (existingItem) {
      console.log(
        `[${timestamp}] Found existing Draft record: ${existingItem.id} for "${userName}"`
      );
      return {
        id: existingItem.id,
        item: existingItem,
        canUpdate: true,
      };
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

// Function to update student record with donor comment reference
async function updateStudentRecord(
  studentName,
  donorCommentId,
  updateConfig,
  apiKey,
  timestamp
) {
  try {
    console.log(
      `[${timestamp}] Updating student record for: "${studentName}" with donor comment ID: "${donorCommentId}"`
    );

    if (!updateConfig.enabled || !updateConfig.collectionId) {
      console.log(
        `[${timestamp}] Student record update not enabled or no collection ID`
      );
      return { success: false, reason: "Update not enabled" };
    }

    if (!donorCommentId) {
      console.log(
        `[${timestamp}] No donor comment ID provided for student update`
      );
      return { success: false, reason: "No donor comment ID provided" };
    }

    // First, find the student record
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

    console.log(`[${timestamp}] Found ${items.length} student items`);

    // Find the student by name
    const studentItem = items.find((item) => {
      const itemValue = item.fieldData[updateConfig.lookupField];
      if (!itemValue) return false;
      return (
        itemValue.toLowerCase().trim() === studentName.toLowerCase().trim()
      );
    });

    if (!studentItem) {
      console.log(`[${timestamp}] Student not found: "${studentName}"`);
      return { success: false, reason: `Student not found: ${studentName}` };
    }

    console.log(`[${timestamp}] Found student record: ${studentItem.id}`);

    // Debug: Log all field names in the student record to identify the correct field
    console.log(`[${timestamp}] Available fields in student record:`);
    Object.keys(studentItem.fieldData).forEach((fieldName) => {
      if (fieldName.includes("donor")) {
        console.log(
          `  - ${fieldName}: ${JSON.stringify(
            studentItem.fieldData[fieldName]
          )}`
        );
      }
    });

    // Get current multi-reference field value (should be an array of IDs)
    const currentDonorMessages =
      studentItem.fieldData[updateConfig.updateField] || [];
    console.log(
      `[${timestamp}] Current ${updateConfig.updateField} references:`,
      currentDonorMessages
    );

    // Ensure it's an array
    const currentReferences = Array.isArray(currentDonorMessages)
      ? currentDonorMessages
      : [];

    // Check if this donor comment ID already exists to avoid duplicates
    if (currentReferences.includes(donorCommentId)) {
      console.log(
        `[${timestamp}] Donor comment ID "${donorCommentId}" already exists in references`
      );
      return {
        success: true,
        reason: "Donor comment already referenced",
        noUpdate: true,
      };
    }

    // Add the new donor comment ID to the array
    const updatedReferences = [...currentReferences, donorCommentId];
    console.log(
      `[${timestamp}] Updated ${updateConfig.updateField} references will be:`,
      updatedReferences
    );

    // Update the student record
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

    console.log(
      `[${timestamp}] Updating student record with payload:`,
      JSON.stringify(updatePayload, null, 2)
    );

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

    console.log(
      `[${timestamp}] Student update response status: ${updateResponse.status}`
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error(
        `[${timestamp}] Failed to update student record: ${updateResponse.status} - ${errorText}`
      );
      return { success: false, error: errorText };
    }

    const updateResult = await updateResponse.json();
    console.log(`[${timestamp}] Student record updated successfully`);

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

// Function to publish specific CMS items using bulk publish endpoint
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
        body: JSON.stringify({
          itemIds: itemIds,
        }),
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
    // ENHANCED: Check if this is an automated/bot request
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

    // If it's likely an automated request, return early with minimal logging
    if (automatedCheck.isLikelyAutomated) {
      console.log(
        `[${timestamp}] AUTOMATED REQUEST DETECTED - Returning early to avoid spam`
      );
      return res.status(200).json({
        message: "Webhook endpoint is healthy",
        timestamp,
        note: "Automated request detected",
      });
    }

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
          requestInfo: {
            userAgent: automatedCheck.userAgent,
            referer: automatedCheck.referer,
            contentType: req.headers["content-type"],
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

    // ENHANCED DEBUGGING: Show all form field names to help with mapping
    console.log(`[${timestamp}] === FORM FIELD DEBUGGING ===`);
    console.log(`[${timestamp}] Available form fields:`);
    Object.keys(formData).forEach((key, index) => {
      console.log(
        `[${timestamp}]   ${index + 1}. "${key}" = "${formData[key]}"`
      );
    });
    console.log(`[${timestamp}] === END FORM FIELD DEBUGGING ===`);

    // Get form configuration
    const formConfig = FORM_CONFIGS[formId];
    if (!formConfig) {
      console.log(`[${timestamp}] Unknown form ID: ${formId}`);
      return res.status(400).json({
        error: "Unknown form ID",
        formId,
        supportedForms: Object.keys(FORM_CONFIGS),
        availableFormFields: Object.keys(formData),
        requestInfo: {
          userAgent: automatedCheck.userAgent,
          referer: automatedCheck.referer,
        },
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
        requiredEnvVar: "WEBFLOW_GENRLAPPL_COLLECTION_ID",
        availableEnvVars: {
          WEBFLOW_API_KEY: !!process.env.WEBFLOW_API_KEY,
          WEBFLOW_DONOR_COMMENTS_COLLECTION_ID:
            !!process.env.WEBFLOW_DONOR_COMMENTS_COLLECTION_ID,
          WEBFLOW_STUDENTSCRFD_COLLECTION_ID:
            !!process.env.WEBFLOW_STUDENTSCRFD_COLLECTION_ID,
          WEBFLOW_GENRLAPPL_COLLECTION_ID:
            !!process.env.WEBFLOW_GENRLAPPL_COLLECTION_ID,
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
    const skippedFields = [];

    try {
      // Map form fields according to configuration
      for (const [webflowField, cmsField] of Object.entries(
        formConfig.fieldMapping
      )) {
        const value = formData[webflowField];
        console.log(
          `[${timestamp}] Processing field: ${webflowField} -> ${cmsField} with value: "${value}"`
        );

        if (value !== undefined && value !== null && value !== "") {
          // Check if this is a reference field
          if (
            formConfig.referenceFields &&
            formConfig.referenceFields[cmsField]
          ) {
            console.log(
              `[${timestamp}] Processing reference field: ${cmsField} with value: "${value}"`
            );

            const referenceConfig = formConfig.referenceFields[cmsField];

            if (!referenceConfig.collectionId) {
              console.log(
                `[${timestamp}] No collection ID for reference field ${cmsField}`
              );
              if (referenceConfig.fallbackToText) {
                console.log(
                  `[${timestamp}] Using fallback text value for ${cmsField}`
                );
                extractedData[cmsField] = value;
              } else {
                console.log(
                  `[${timestamp}] Skipping reference field ${cmsField} - no collection ID`
                );
                skippedFields.push(`${cmsField} (no collection ID)`);
                continue;
              }
            } else {
              // Look up the reference item
              const referenceResult = await lookupReferenceItem(
                value,
                referenceConfig,
                process.env.WEBFLOW_API_KEY,
                timestamp
              );

              if (referenceResult && referenceResult.id) {
                extractedData[cmsField] = referenceResult.id;
                console.log(
                  `[${timestamp}] Mapped reference field ${cmsField} to ID: ${referenceResult.id}`
                );
              } else {
                console.log(
                  `[${timestamp}] Could not resolve reference for ${cmsField}: "${value}"`
                );

                if (referenceConfig.fallbackToText) {
                  console.log(
                    `[${timestamp}] Using fallback text value for ${cmsField}`
                  );
                  extractedData[cmsField] = value;
                } else {
                  console.log(
                    `[${timestamp}] Skipping reference field ${cmsField} - no match found`
                  );
                  skippedFields.push(`${cmsField} (no match for "${value}")`);
                  continue;
                }
              }
            }
          } else {
            // Regular field mapping
            extractedData[cmsField] = value;
            console.log(
              `[${timestamp}] Mapped regular field ${cmsField}: "${value}"`
            );
          }
        } else {
          console.log(`[${timestamp}] Skipping empty field: ${webflowField}`);
        }

        // Check required fields
        if (
          formConfig.requiredFields.includes(webflowField) &&
          (!value || value.trim() === "")
        ) {
          missingRequired.push(webflowField);
        }
      }

      // NEW: Apply dynamic status override for General Applications form
      if (formConfig.statusOverride && formConfig.statusOverride.enabled) {
        let statusValue;

        if (typeof formConfig.statusOverride.getValue === "function") {
          // Use dynamic status determination
          statusValue = formConfig.statusOverride.getValue(formData);
        } else {
          // Use static value (backward compatibility)
          statusValue = formConfig.statusOverride.value;
        }

        const originalStatus = extractedData[formConfig.statusOverride.field];
        extractedData[formConfig.statusOverride.field] = statusValue;

        console.log(
          `[${timestamp}] DYNAMIC STATUS OVERRIDE: Changed ${formConfig.statusOverride.field} from "${originalStatus}" to "${statusValue}"`
        );
      }

      console.log(`[${timestamp}] Extracted data:`, extractedData);
      if (skippedFields.length > 0) {
        console.log(`[${timestamp}] Skipped fields:`, skippedFields);
      }

      // Enhanced debugging: Show unmapped fields
      const mappedFields = Object.keys(formConfig.fieldMapping);
      const unmappedFields = Object.keys(formData).filter(
        (field) => !mappedFields.includes(field)
      );
      if (unmappedFields.length > 0) {
        console.log(`[${timestamp}] === UNMAPPED FIELDS ===`);
        console.log(
          `[${timestamp}] These form fields are not mapped to CMS fields:`
        );
        unmappedFields.forEach((field, index) => {
          console.log(
            `[${timestamp}]   ${index + 1}. "${field}" = "${formData[field]}"`
          );
        });
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

    // Ensure 'name' field exists (required by Webflow API)
    if (!extractedData.name) {
      const firstValue =
        Object.values(extractedData)[0] || `Submission ${Date.now()}`;
      extractedData.name = firstValue;
      console.log(`[${timestamp}] Generated name field: ${extractedData.name}`);
    }

    // NEW LOGIC: Check for existing record to update (only for General Applications)
    let existingRecord = null;
    let isUpdate = false;

    if (
      formConfig.updateExistingRecord &&
      formConfig.updateExistingRecord.enabled &&
      extractedData.name
    ) {
      existingRecord = await checkForExistingRecord(
        extractedData.name,
        formConfig.updateExistingRecord,
        formConfig.collectionId,
        process.env.WEBFLOW_API_KEY,
        timestamp
      );

      if (existingRecord && existingRecord.canUpdate) {
        isUpdate = true;
        console.log(
          `[${timestamp}] Will update existing record: ${existingRecord.id}`
        );
      } else {
        console.log(`[${timestamp}] Will create new record`);
      }
    }

    // Create payload for either CREATE or UPDATE
    let payload;
    let webflowResponse;

    if (isUpdate && existingRecord) {
      // UPDATE existing record - SET TO PUBLISHED STATUS
      payload = {
        items: [
          {
            id: existingRecord.id,
            isArchived: false,
            isDraft: false, // CHANGED: Set to published when submitting
            fieldData: {
              ...existingRecord.item.fieldData, // Keep existing data
              ...extractedData, // Override with new form data (including "Submitted" status)
              slug: existingRecord.item.fieldData.slug || slug, // Keep existing slug or use new one
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
      // CREATE new record - SET TO PUBLISHED STATUS
      payload = {
        items: [
          {
            isArchived: false,
            isDraft: false, // CHANGED: Set to published when submitting
            fieldData: {
              ...extractedData, // Includes "Submitted" status
              slug: slug,
            },
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

    // Handle API response
    try {
      console.log(
        `[${timestamp}] Making ${
          isUpdate ? "UPDATE" : "CREATE"
        } request to Webflow API...`
      );
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
          availableFormFields: Object.keys(formData),
          configuredFieldMappings: formConfig.fieldMapping,
          extractedData: extractedData,
          isUpdate: isUpdate,
          existingRecordId: existingRecord?.id,
          timestamp,
        });
      }

      const responseData = await webflowResponse.json();
      console.log(
        `[${timestamp}] CMS item ${
          isUpdate ? "updated" : "created"
        } successfully`
      );

      // Get the item ID (for updates, it's the existing ID; for creates, it's the new ID)
      const itemId = isUpdate ? existingRecord.id : responseData.items?.[0]?.id;
      // EXPLICIT PUBLISHING: Publish the CMS item immediately after creation/update
      let publishResult = { success: false };
      if (itemId) {
        console.log(`[${timestamp}] Publishing CMS item: ${itemId}`);
        publishResult = await publishCmsItems(
          [itemId],
          formConfig.collectionId,
          process.env.WEBFLOW_API_KEY,
          timestamp
        );

        if (publishResult.success) {
          console.log(`[${timestamp}] CMS item published successfully`);
        } else {
          console.error(
            `[${timestamp}] Failed to publish CMS item:`,
            publishResult.error
          );
        }
      } else {
        console.error(`[${timestamp}] No item ID found for publishing`);
        publishResult = { success: false, error: "No item ID found" };
      }
      let studentUpdateResult = { success: false };

      // Update student record with donor comment reference (only for donor comments form)
      if (
        formConfig.updateStudentRecord &&
        formConfig.updateStudentRecord.enabled
      ) {
        const studentName = formData.StudentProfile;

        if (studentName && itemId) {
          console.log(
            `[${timestamp}] Updating student "${studentName}" with donor comment ID "${itemId}"`
          );
          studentUpdateResult = await updateStudentRecord(
            studentName,
            itemId,
            formConfig.updateStudentRecord,
            process.env.WEBFLOW_API_KEY,
            timestamp
          );

          // Publish the updated student record if the update was successful
          if (studentUpdateResult.success && studentUpdateResult.studentId) {
            console.log(
              `[${timestamp}] Publishing updated student record: ${studentUpdateResult.studentId}`
            );
            const studentPublishResult = await publishCmsItems(
              [studentUpdateResult.studentId],
              formConfig.updateStudentRecord.collectionId,
              process.env.WEBFLOW_API_KEY,
              timestamp
            );

            // Add student publish result to the response
            studentUpdateResult.publishResult = studentPublishResult;

            if (studentPublishResult.success) {
              console.log(
                `[${timestamp}] Student record published successfully`
              );
            } else {
              console.log(
                `[${timestamp}] Failed to publish student record:`,
                studentPublishResult.error
              );
            }
          }
        } else {
          console.log(
            `[${timestamp}] Missing student name or donor comment ID for update`
          );
          studentUpdateResult = {
            success: false,
            reason: "Missing student name or donor comment ID",
          };
        }
      }

      res.status(200).json({
        success: true,
        message: `${formConfig.name} submission processed successfully`,
        action: isUpdate ? "updated" : "created",
        status: extractedData["application-status"], // Always "Submitted" when form is submitted
        formId,
        formName: formConfig.name,
        data: responseData,
        extractedFields: extractedData,
        skippedFields: skippedFields,
        publishResult: publishResult,
        studentUpdateResult: studentUpdateResult,
        itemId: itemId,
        isUpdate: isUpdate,
        existingRecordId: existingRecord?.id,
        availableFormFields: Object.keys(formData),
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
