import { FastifyRequest } from "fastify";
import { MultipartFile } from "@fastify/multipart";
import { errors } from "./errorUtils.ts";
import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";

// Upload configuration
export const UPLOAD_CONFIG = {
  uploadsDir: path.join(process.cwd(), "uploads", "avatars"),
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedMimeTypes: ["image/jpeg", "image/png"],
  allowedExtensions: [".jpg", ".jpeg", ".png"],
};

// Ensure uploads directory exists
export async function ensureUploadsDirExists(): Promise<void> {
  try {
    await fs.mkdir(UPLOAD_CONFIG.uploadsDir, { recursive: true });
  } catch (error) {
    throw errors.internal("Failed to create uploads directory");
  }
}

// Generate unique filename
export function generateUniqueFilename(originalFilename: string): string {
  const ext = path.extname(originalFilename).toLowerCase();
  const randomName = randomBytes(16).toString("hex");
  return `${randomName}${ext}`;
}

// Validate file type
export function validateFileType(mimetype: string, filename: string): void {
  const ext = path.extname(filename).toLowerCase();
  
  if (!UPLOAD_CONFIG.allowedMimeTypes.includes(mimetype)) {
    throw errors.validation(
      `Invalid file type. Only JPEG and PNG images are allowed. Received: ${mimetype}`
    );
  }
  
  if (!UPLOAD_CONFIG.allowedExtensions.includes(ext)) {
    throw errors.validation(
      `Invalid file extension. Only .jpg, .jpeg, and .png are allowed. Received: ${ext}`
    );
  }
}

// Validate file size
export function validateFileSize(size: number): void {
  if (size > UPLOAD_CONFIG.maxFileSize) {
    throw errors.validation(
      `File size exceeds maximum allowed size of ${UPLOAD_CONFIG.maxFileSize / 1024 / 1024}MB`
    );
  }
}

// Save uploaded file
export async function saveUploadedFile(file: MultipartFile): Promise<string> {
  await ensureUploadsDirExists();
  
  // Validate file
  validateFileType(file.mimetype, file.filename);
  
  // Generate unique filename
  const uniqueFilename = generateUniqueFilename(file.filename);
  const filePath = path.join(UPLOAD_CONFIG.uploadsDir, uniqueFilename);
  
  // Get file buffer
  const buffer = await file.toBuffer();
  
  // Validate size
  validateFileSize(buffer.length);
  
  // Save file
  await fs.writeFile(filePath, buffer);
  
  // Return the URL path (relative to the static server)
  return `/uploads/avatars/${uniqueFilename}`;
}

// Delete uploaded file (for cleanup)
export async function deleteUploadedFile(avatarUrl: string): Promise<void> {
  try {
    // Extract filename from URL
    const filename = path.basename(avatarUrl);
    const filePath = path.join(UPLOAD_CONFIG.uploadsDir, filename);
    await fs.unlink(filePath);
  } catch (error) {
    // Silently fail if file doesn't exist
    console.error("Failed to delete file:", error);
  }
}
