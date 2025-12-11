import { Agent, createTool } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { api, components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

/**
 * Tool: saveHistoryCheckpoints
 *
 * Given a synthesized list of history checkpoints for a repo, insert
 * them into the historyCheckpoints table.
 */
export const saveHistoryCheckpoints = createTool({
  description:
    "Insert a small set of synthesized history checkpoints for a repository.",
  args: z.object({
    repoId: z.string().describe("Convex id of the repo (as string)."),
    checkpoints: z
      .array(
        z.object({
          title: z.string().describe("Short, human-readable title."),
          description: z
            .string()
            .optional()
            .describe("1–3 sentence description of the milestone."),
          eventAt: z
            .number()
            .optional()
            .describe(
              "Unix timestamp (ms) when this milestone roughly occurred. If omitted, now() is used.",
            ),
        }),
      )
      .min(1)
      .max(10)
      .describe("3–10 key checkpoints to store."),
  }),
  handler: async (ctx, { repoId, checkpoints }) => {
    const typedRepoId = repoId as Id<"repos">;
    const now = Date.now();

    for (const cp of checkpoints) {
      await ctx.runMutation(api.app.createHistoryCheckpoint, {
        repoId: typedRepoId,
        title: cp.title,
        description: cp.description,
        sourceType: "manual",
        prAnalysisId: undefined,
        analysisSessionId: undefined,
        callId: undefined,
        eventAt: cp.eventAt ?? now,
      });
    }

    return { count: checkpoints.length };
  },
});

/**
 * History Synthesis Agent
 *
 * Periodically compresses raw PR analyses, snapshots and call decisions
 * into a small set of human-readable history checkpoints.
 */
export const historySynthesisAgent = new Agent(components.agent, {
  name: "History Synthesis Agent",
  languageModel: openai.chat("gpt-4o-mini"),
  instructions: [
    "You compress raw development activity into a concise history timeline.",
    "You will be given JSON containing a repository id and arrays of PR analyses, analysis sessions, calls and existing checkpoints for a time window.",
    "Choose the 3–10 most important milestones that a future engineer should know about.",
    "For each, create a short title and a 1–3 sentence description, and pick a representative timestamp.",
    "Then call the `saveHistoryCheckpoints` tool exactly once with your synthesized checkpoints.",
  ].join(" "),
  tools: {
    saveHistoryCheckpoints,
  },
  maxSteps: 4,
});
