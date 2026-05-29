import { createPasswordHash } from "../src/features/auth/server/index.ts";

const usage =
  'Usage: ./scripts/with-node.sh pnpm auth:hash-password -- "your-password"';
const passwordArgs = process.argv.slice(2).filter((value) => value !== "--");
const password = passwordArgs[0];

if (password === undefined || password.length === 0) {
  console.error(usage);
  process.exit(1);
}

if (passwordArgs.length > 1) {
  console.error(
    "Password must be passed as one argument. Wrap passwords with spaces in quotes."
  );
  console.error(usage);
  process.exit(1);
}

console.info(createPasswordHash(password));
