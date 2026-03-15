import { createPasswordHash } from "../src/lib/auth.ts";

const password = process.argv
  .slice(2)
  .find((value) => value !== "--")
  ?.trim();

if (!password) {
  console.error(
    "Usage: ./scripts/with-node.sh pnpm auth:hash-password -- \"your-password\""
  );
  process.exit(1);
}

console.info(createPasswordHash(password));
