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

  /// General Applications form
  "680ffe82754f33838006203e": {
    name: "General Applications",
    collectionId: process.env.WEBFLOW_GENRLAPPL_COLLECTION_ID, // Using environment variable
    fieldMapping: {
      // Common form fields - customize these based on your actual form fields
      FirstName: "first-name",
      LastName: "last-name",
      Email: "email",
      Phone: "phone",
      UserName: "user-name", // This will be the main name field
      DateOfBirth: "date-of-birth",
      School: "school",
      SchoolYear: "school-year",
      Degree: "degree",
      Major: "major",
      AnticipatedGraduationDate: "anticipated-graduation-date",
      FullTime: "full-time",
      RequiredCredits: "required-credits",
      RemainingCredits: "remaining-credits",
      GPA: "gpa",
      Address: "address",
      City: "city",
      State: "state",
      Zip: "zip",
      CurrentAddressCheckbox: "current-address-checkbox",
      ResidencyDuration: "residency-duration",
      FundingOpportunities: "funding-opportunities",
      FundingTerm: "funding-term",
      EmploymentStatus: "employment-status",
      OtherSourcesofIncome: "other-sources-of-income",
      TotalMonthlyIncome: "total-monthly-income",
      MonthlyHousingPayment: "monthly-housing-payment",
      HaveDebt: "have-debt",
      TotalDebtAmount: "total-debt-amount",
    },
    requiredFields: ["FirstName", "LastName", "Email"], // Customize based on your required fields
    referenceFields: {
      // Add reference field configurations if needed
      // Example:
      // "department": {
      //   collectionId: process.env.WEBFLOW_DEPARTMENTS_COLLECTION_ID,
      //   lookupField: "name",
      //   createIfNotFound: false,
      //   fallbackToText: true,
      // },
    },
    generateSlug: (data) => {
      try {
        const name = data["LastName"] || data["FirstName"] || data["Email"];
        return `application-${name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")}-${Date.now()}`;
      } catch (error) {
        return `application-${Date.now()}`;
      }
    },
    // Don't add automatic date fields unless they exist in your CMS schema
    addAutomaticFields: false,
  },
};
