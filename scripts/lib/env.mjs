// Charge .env.local pour les scripts Node (Next.js le fait seul pour l'application).
import { existsSync } from "node:fs";

export function loadEnvLocal() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.includes("<")) {
    console.error(`${name} manque dans .env.local (voir .env.example).`);
    process.exit(1);
  }
  return value;
}

/**
 * SSL pour une base distante, pas pour une base locale ni pour le réseau interne Docker du VPS
 * (`?sslmode=disable` dans l'URL, voir deploy/docker-compose.yml).
 */
export function pgSsl(connectionString) {
  if (/[?&]sslmode=disable\b/.test(connectionString)) return false;
  return /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString) ? false : { rejectUnauthorized: false };
}
