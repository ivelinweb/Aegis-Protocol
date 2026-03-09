import "dotenv/config";
import { loadCreWorkflowConfig } from "./config";
import { loadCreRuntimeSnapshot } from "./runtime";
import { printCreBanner, printCrePrelude, printCreSteps, printCreSummary } from "./transcript";
import { buildCreWorkflowSteps } from "./workflow";

export async function runCreWorkflowLiveTest(): Promise<void> {
  const config = loadCreWorkflowConfig();
  const runtime = await loadCreRuntimeSnapshot(config);
  const steps = buildCreWorkflowSteps(config, runtime);

  printCreBanner();
  printCrePrelude(config);
  printCreSteps(steps);
  printCreSummary(config);
}

export const runCreWorkflowSimulation = runCreWorkflowLiveTest;

if (require.main === module) {
  runCreWorkflowLiveTest().catch((error) => {
    console.error("[Aegis CRE] Fatal error:", error);
    process.exit(1);
  });
}