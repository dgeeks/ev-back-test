export type RequiredFiles = {
  driverLicense: Express.Multer.File[];
  insurance: Express.Multer.File[];
  electricCertificate: Express.Multer.File[];
};

export const MAX_FILE_SIZE = 5 * 1024 * 1024;
