// Use Node.js built-in fetch instead of axios to avoid dependency issues
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

    // Create CMS item via Webflow API using fetch
    const response = await fetch(
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

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Webflow API error:", response.status, errorData);
      return res.status(response.status).json({
        error: "Failed to create CMS item",
        details: errorData,
      });
    }

    const responseData = await response.json();
    console.log("CMS item created:", responseData);

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Error creating CMS item:", error.message);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
}
