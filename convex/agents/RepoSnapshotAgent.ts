import { Agent, createTool } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { api, components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

/**
 * Tool: saveRepoSnapshotResult
 *
 * Persist the result of a repo snapshot analysis into an analysisSession
 * row and create an optional history checkpoint for the snapshot.
 */
export const saveRepoSnapshotResult = createTool({
  description:
    "Save the result of a repo snapshot analysis into analysisSessions.config and create an optional history checkpoint.",
  args: z.object({
    analysisSessionId: z
      .string()
      .describe("Convex id of the analysisSessions row (as string)."),
    repoId: z.string().describe("Convex id of the repo (as string)."),
    techStackSummary: z
      .string()
      .describe("Short paragraph summarizing the tech stack."),
    mainModules: z
      .array(z.string())
      .describe("List of key modules / areas in the repo."),
    riskyAreas: z
      .array(z.string())
      .describe("List of higher-risk or high-churn areas in the codebase."),
    suggestedNextSteps: z
      .array(z.string())
      .describe("3–8 suggested next steps / roadmap bullets."),
  }),
  handler: async (
    ctx,
    {
      analysisSessionId,
      repoId,
      techStackSummary,
      mainModules,
      riskyAreas,
      suggestedNextSteps,
    },
  ): Promise<{ analysisSessionId: Id<"analysisSessions"> }> => {
    const typedSessionId = analysisSessionId as Id<"analysisSessions">;
    const typedRepoId = repoId as Id<"repos">;

    // Store structured snapshot on the analysis session.
    await ctx.runMutation(api.app.updateAnalysisSessionSummaryAndConfig, {
      analysisSessionId: typedSessionId,
      summary: techStackSummary,
      config: {
        snapshot: {
          techStackSummary,
          mainModules,
          riskyAreas,
          suggestedNextSteps,
        },
      },
    });

    // Also create a history checkpoint so the snapshot shows up
    // in the repo's timeline. We use "analysis_session" as sourceType.
    await ctx.runMutation(api.app.createHistoryCheckpoint, {
      repoId: typedRepoId,
      title: "Repo snapshot completed",
      description: techStackSummary,
      sourceType: "analysis_session",
      prAnalysisId: undefined,
      analysisSessionId: typedSessionId,
      callId: undefined,
      eventAt: Date.now(),
    });

    return { analysisSessionId: typedSessionId };
  },
});

/**
 * Repo Snapshot Agent
 *
 * Given high-level repo context (tech stack, file tree description,
 * recent PR analyses), this agent produces a concise JSON snapshot and
 * calls `saveRepoSnapshotResult` once to persist it.
 */
export const repoSnapshotAgent = new Agent(components.agent, {
  name: "Repo Snapshot Analyzer",
  languageModel: openai.chat("gpt-4o-mini"),
  instructions: [
    "You are a staff engineer summarizing the current state of a codebase.",
    "You will be given JSON describing: basic repo info, tech stack items, recent PR analysis summaries, and any existing history checkpoints.",
    "Your job is to synthesize this into a snapshot containing: (1) tech stack summary paragraph, (2) main modules/areas, (3) risky or high-churn areas, (4) suggested next steps.",
    "Then you MUST call the `saveRepoSnapshotResult` tool exactly once with your structured result.",
    "Keep outputs concise and actionable; avoid repeating low-level details.",
  ].join(" "),
  tools: {
    saveRepoSnapshotResult,
  },
  maxSteps: 4,
});
