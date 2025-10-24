// Response data shapes (used with ApiResponse<T>)
export interface Setup2FAData {
  secret: string;
  qrCodeUrl: string;
  manualEntryKey: string;
}

export interface Verify2FAData {
  valid: boolean;
}

// Request bodies
export interface Verify2FARequest {
  userId: number;
  token: string;
}

export interface Enable2FARequest {
  userId: number;
  token: string;
}

export interface Disable2FARequest {
  userId: number;
  token: string;
}