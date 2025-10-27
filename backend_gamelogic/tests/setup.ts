// Test setup file
// This file runs before all tests

import { beforeAll, afterAll } from "vitest";

// Set test environment variables if needed
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "test";
}

beforeAll(() => {
  // Global setup if needed
});

afterAll(() => {
  // Global cleanup if needed
});
