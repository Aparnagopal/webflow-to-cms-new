// Separate configuration file for better organization
export const FORM_CONFIGS = {
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
      },
    },
    generateSlug: (data) =>
      `school-${data.Name?.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
    generateMessageDateTime: (data) => `${Date.now()}`,
  },

  // Add more forms here...
};
