// Response data shapes (used with ApiResponse<T>)
export interface Setup2FAData {
  secret: string;
  qrCodeUrl: string;
  manualEntryKey: string;
}

export interface Verify2FAData {
  valid: boolean;
}

// Request bodies (userId comes from params now)
export interface Verify2FARequest {
  twofa_code: string;
}

export interface Enable2FARequest {
  twofa_code: string;
}

export interface Disable2FARequest {
  twofa_code: string;
}
