import app from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/db.js";
import { ensureDemoUsers } from "./utils/ensureDemoUsers.js";

async function start() {
  await connectDatabase();

  if (env.seedDemoUsersOnStartup) {
    const seeded = await ensureDemoUsers();
    seeded.forEach((item) => {
      console.log(`[demo-seed] ${item.created ? "Created" : "Exists"}: ${item.email}`);
    });
  }

  app.listen(env.port, () => {
    console.log(`AegisCare API listening on port ${env.port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});