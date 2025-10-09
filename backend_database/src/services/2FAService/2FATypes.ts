export interface Setup2FAResponse {
  secret: string;
  qrCodeUrl: string;
  manualEntryKey: string;
}

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

export interface Verify2FAResponse {
  valid: boolean;
}