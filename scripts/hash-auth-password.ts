import { createPasswordHash } from "../src/lib/auth.ts";

const password = process.argv[2]?.trim();

if (!password) {
  console.error(
    "Usage: ./scripts/with-node.sh pnpm auth:hash-password -- \"your-password\""
  );
  process.exit(1);
}

console.info(createPasswordHash(password));
