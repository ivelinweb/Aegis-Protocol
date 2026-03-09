import "dotenv/config";
import { runCreWorkflowSimulation } from "./cre";

runCreWorkflowSimulation().catch((error) => {
  console.error("[Aegis CRE] Fatal error:", error);
  process.exit(1);
});