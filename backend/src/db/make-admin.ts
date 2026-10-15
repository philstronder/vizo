import "../lib/env";
import { pool } from "./pool";
import { setUserAdmin } from "./users";

// Grants (or with --revoke, removes) admin rights for an existing account.
//   npm run user:make-admin -- someone@example.com [--revoke]
async function main() {
  const args = process.argv.slice(2);
  const email = args.find((a) => !a.startsWith("--"));
  const revoke = args.includes("--revoke");
  if (!email) {
    console.error("Usage: npm run user:make-admin -- <email> [--revoke]");
    process.exit(1);
  }
  const user = await setUserAdmin(email, !revoke);
  if (!user) {
    console.error(`No user with email ${email}`);
    process.exitCode = 1;
  } else {
    console.log(`${user.email} is ${user.is_admin ? "now an admin" : "no longer an admin"}`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
