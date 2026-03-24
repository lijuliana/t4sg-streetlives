// Fill these in via your .env.local file (Vite project)
export const BASE_URL = import.meta.env.VITE_MATRIX_BASE_URL as string;
export const ACCESS_TOKEN = import.meta.env.VITE_MATRIX_ACCESS_TOKEN as string;
export const USER_ID = import.meta.env.VITE_MATRIX_USER_ID as string;

if (!BASE_URL || !ACCESS_TOKEN || !USER_ID) {
  console.warn(
    "[matrixClient] Missing one or more required env vars: " +
      "VITE_MATRIX_BASE_URL, VITE_MATRIX_ACCESS_TOKEN, VITE_MATRIX_USER_ID"
  );
}
