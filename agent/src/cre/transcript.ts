import type { CreWorkflowConfig } from "./config";
import type { WorkflowStep } from "./workflow";

export function printCreBanner(): void {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║   AEGIS PROTOCOL — CRE + TENDERLY WORKFLOW RUNNER           ║
║   Tenderly virtual network live testing with RPC reads       ║
╚═══════════════════════════════════════════════════════════════╝
`);
}

export function printCrePrelude(config: CreWorkflowConfig): void {
  console.log(`Workflow ID : ${config.workflowId}`);
  console.log(`Target      : ${config.target}`);
  console.log(`Network     : ${config.networkLabel}`);
  console.log(`RPC         : ${config.rpcUrl}`);
  console.log(`Explorer    : ${config.explorerUrl}`);
  console.log(`Project     : agent/cre/project.yaml`);
}

export function printCreSteps(steps: WorkflowStep[]): void {
  for (const step of steps) {
    console.log(`\n${"═".repeat(68)}`);
    console.log(`  ${step.title}`);
    console.log(`${"═".repeat(68)}`);
    for (const line of step.lines) {
      console.log(`  > ${line}`);
    }
    console.log(`  ✓ ${step.summary}`);
  }
}

export function printCreSummary(config: CreWorkflowConfig): void {
  console.log(`\n${"═".repeat(68)}`);
  console.log("  CRE WORKFLOW LIVE TEST COMPLETE");
  console.log(`${"═".repeat(68)}`);
  console.log(`  Final Tenderly test reference: ${config.txHash}`);
  console.log(`  Inspect in Tenderly explorer: ${config.explorerUrl}/tx/${config.txHash}`);
  console.log("  No Ethereum mainnet state was modified.\n");
}