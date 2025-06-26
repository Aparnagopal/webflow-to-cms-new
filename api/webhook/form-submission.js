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
      updateField: "donor_message", // Multi-reference field to update in student record
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
};

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

    // Get current multi-reference field value (should be an array of IDs)
    const currentDonorMessages =
      studentItem.fieldData[updateConfig.updateField] || [];
    console.log(
      `[${timestamp}] Current donor_message references:`,
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
      `[${timestamp}] Updated donor_message references will be:`,
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
          WEBFLOW_STUDENTSCRFD_COLLECTION_ID:
            !!process.env.WEBFLOW_STUDENTSCRFD_COLLECTION_ID,
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

      console.log(`[${timestamp}] Extracted data:`, extractedData);
      if (skippedFields.length > 0) {
        console.log(`[${timestamp}] Skipped fields:`, skippedFields);
      }

      console.log(`[${timestamp}] All available fields in form data:`);
      Object.keys(formData).forEach((key) => {
        console.log(`  - ${key}: "${formData[key]}"`);
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
      const firstValue =
        Object.values(extractedData)[0] || `Submission ${Date.now()}`;
      extractedData.name = firstValue;
      console.log(`[${timestamp}] Generated name field: ${extractedData.name}`);
    }

    // Create CMS payload - Create as draft first, then publish
    const payload = {
      items: [
        {
          isArchived: false,
          isDraft: true, // Create as draft first
          fieldData: {
            ...extractedData,
            slug: slug,
            "message-date-time": messageDateTime, // Add the date-time field
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

      // Get the created item ID
      const createdItemId = responseData.items?.[0]?.id;
      let publishResult = { success: false };
      let studentUpdateResult = { success: false };

      // Try to publish the specific item using bulk publish endpoint
      if (createdItemId) {
        console.log(
          `[${timestamp}] Attempting to publish item: ${createdItemId}`
        );
        publishResult = await publishCmsItems(
          [createdItemId],
          formConfig.collectionId,
          process.env.WEBFLOW_API_KEY,
          timestamp
        );

        // Update student record with donor comment reference (after successful creation)
        if (
          formConfig.updateStudentRecord &&
          formConfig.updateStudentRecord.enabled
        ) {
          const studentName = formData.StudentProfile;

          if (studentName && createdItemId) {
            console.log(
              `[${timestamp}] Updating student "${studentName}" with donor comment ID "${createdItemId}"`
            );
            studentUpdateResult = await updateStudentRecord(
              studentName,
              createdItemId,
              formConfig.updateStudentRecord,
              process.env.WEBFLOW_API_KEY,
              timestamp
            );
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
      } else {
        console.log(
          `[${timestamp}] No item ID found in response, cannot publish or update student`
        );
      }

      res.status(200).json({
        success: true,
        message: `${formConfig.name} submission processed successfully`,
        formId,
        formName: formConfig.name,
        data: responseData,
        extractedFields: extractedData,
        skippedFields: skippedFields,
        publishResult: publishResult,
        studentUpdateResult: studentUpdateResult,
        itemId: createdItemId,
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
