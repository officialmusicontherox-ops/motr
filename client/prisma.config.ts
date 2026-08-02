import { defineConfig, env } from "prisma/config";

// Local dev keeps secrets in .env; hosted environments (Vercel) inject them
// directly and have no such file, where loadEnvFile would throw.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env — the environment is expected to already carry DATABASE_URL.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "node prisma/seed.ts",
  },
});
