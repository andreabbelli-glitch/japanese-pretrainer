import path from "node:path";

import dotenv from "dotenv";

const explicitEnvironment = { ...process.env };

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });
dotenv.config({
  override: true,
  path: path.resolve(process.cwd(), ".env.local"),
  quiet: true
});

for (const [key, value] of Object.entries(explicitEnvironment)) {
  if (typeof value === "string") {
    process.env[key] = value;
  }
}
