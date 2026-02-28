import * as fs from "node:fs";
import * as path from "node:path";

interface ProfileSummary {
  profile: string;
  base_url: string;
  connection_ok: boolean;
  avg_chat_latency_ms: number | null;
  avg_embedding_latency_ms: number | null;
  successful_chat_runs: number;
  successful_embedding_runs: number;
}

interface HardwareBenchmarkReport {
  comparison_mode: "single_profile" | "multi_profile";
  profiles: ProfileSummary[];
}

const INPUT_PATH = path.resolve(process.cwd(), "artifacts/hardware_benchmark_report.json");
const OUTPUT_PATH = path.resolve(process.cwd(), "artifacts/hardware_runtime_gate.json");
const MIN_IMPROVEMENT_RATIO = Number.parseFloat(process.env.HW_RUNTIME_MIN_IMPROVEMENT_RATIO ?? "0.25");

function toPercent(value: number): number {
  return Math.round(value * 1000) / 10;
}

function main(): void {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(`Missing hardware benchmark report at ${INPUT_PATH}`);
  }

  const report = JSON.parse(fs.readFileSync(INPUT_PATH, "utf8")) as HardwareBenchmarkReport;
  const connectedProfiles = report.profiles.filter((item) => item.connection_ok);
  const current = connectedProfiles[0] ?? null;

  let decision = "KEEP_OLLAMA_PRIMARY";
  let recommendedProfile = current?.profile ?? null;
  let reason =
    "Only one connected runtime profile is available. Keep the current Ollama runtime as primary until a second benchmark profile exists.";
  let improvementRatio = 0;

  if (connectedProfiles.length > 1 && current) {
    const challenger = connectedProfiles
      .slice(1)
      .filter((item) => item.avg_chat_latency_ms !== null && item.avg_embedding_latency_ms !== null)
      .sort((a, b) => (a.avg_chat_latency_ms ?? Number.POSITIVE_INFINITY) - (b.avg_chat_latency_ms ?? Number.POSITIVE_INFINITY))[0];

    if (challenger && current.avg_chat_latency_ms !== null && challenger.avg_chat_latency_ms !== null) {
      improvementRatio = (current.avg_chat_latency_ms - challenger.avg_chat_latency_ms) / current.avg_chat_latency_ms;
      const sameChatCoverage = challenger.successful_chat_runs >= current.successful_chat_runs;
      const sameEmbeddingCoverage = challenger.successful_embedding_runs >= current.successful_embedding_runs;

      if (improvementRatio >= MIN_IMPROVEMENT_RATIO && sameChatCoverage && sameEmbeddingCoverage) {
        decision = "SWITCH_RUNTIME";
        recommendedProfile = challenger.profile;
        reason = `Alternate runtime improves average chat latency by ${toPercent(improvementRatio)}% with no loss in benchmark coverage.`;
      } else {
        reason = `Alternate runtime does not clear the gate (improvement=${toPercent(improvementRatio)}%, chat_coverage_ok=${sameChatCoverage}, embedding_coverage_ok=${sameEmbeddingCoverage}).`;
      }
    }
  }

  const payload = {
    generated_at: new Date().toISOString(),
    input_report: INPUT_PATH,
    decision,
    recommended_profile: recommendedProfile,
    min_improvement_ratio: MIN_IMPROVEMENT_RATIO,
    measured_improvement_ratio: improvementRatio,
    reason,
    profiles: report.profiles,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2), "utf8");

  console.log("=== Hardware Runtime Gate ===");
  console.log(`decision: ${decision}`);
  console.log(`recommended_profile: ${recommendedProfile ?? "n/a"}`);
  console.log(`reason: ${reason}`);
  console.log(`report: ${OUTPUT_PATH}`);
}

main();
