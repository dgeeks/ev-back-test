export interface VeriffVerificationResponse {
    verification: {
      id: string;
      status: string;
      vendorData?: string
      url: string
      code?: string;
      reason?: string;
      reasonCode?: string;
      person?: {
        firstName: string;
        lastName: string;
        idNumber: string;
      };
      document?: {
        type: string;
        country: string;
        state?: string;
      };
    };
  }
  