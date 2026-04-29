import { connectDatabase } from "../config/db.js";
import { ensureDemoUsers } from "../utils/ensureDemoUsers.js";

async function main() {
  await connectDatabase();
  const results = await ensureDemoUsers();

  results.forEach((item) => {
    console.log(`${item.created ? "Created" : "Exists"}: ${item.email}`);
  });

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});