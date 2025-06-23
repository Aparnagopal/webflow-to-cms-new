const axios = require("axios");

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const formData = req.body.data;
    if (!formData) {
      return res.status(400).json({ error: "Invalid form data" });
    }

    const { Name, SchoolName, City, Country } = formData;

    // Validate required environment variables
    if (!process.env.WEBFLOW_API_KEY || !process.env.WEBFLOW_COLLECTION_ID) {
      console.error("Missing required environment variables");
      return res.status(500).json({ error: "Server configuration error" });
    }

    // Create CMS item via Webflow API
    const response = await axios.post(
      `https://api.webflow.com/v2/collections/${process.env.WEBFLOW_COLLECTION_ID}/items`,
      {
        isArchived: false,
        isDraft: false,
        fieldData: {
          Name,
          Slug: `submission-${Date.now()}`,
          SchoolName,
          City,
          Country,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WEBFLOW_API_KEY}`,
          "accept-version": "2.0.0",
          "Content-Type": "application/json",
        },
      }
    );

    console.log("CMS item created:", response.data);
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    console.error(
      "Error creating CMS item:",
      error.response ? error.response.data : error.message
    );

    // Return more specific error information
    const statusCode = error.response?.status || 500;
    const errorMessage =
      error.response?.data?.message || "Failed to save to CMS";

    res.status(statusCode).json({
      error: errorMessage,
      details: error.response?.data,
    });
  }
}
