// Separate configuration file for better organization
export const FORM_CONFIGS = {
  // Crowd Funding Donor comments form
  "684184cc1e7d70808e8d1b72": {
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

  // Add more forms here...
};
