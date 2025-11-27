// Response data shapes (used with ApiResponse<T>)
export interface Setup2FAData {
  secret: string;
  qrCodeUrl: string;
  manualEntryKey: string;
}

export interface Verify2FAData {
  valid: boolean;
}

// Request body (userId comes from params now)
export interface TwoFACodeRequest {
  twofa_code: string;
}
