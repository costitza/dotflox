import { Agent, createTool } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { api, components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

/**
 * Tool: saveCallInsights
 *
 * Persist summary, tags, action items, and optional history
 * checkpoints for a single call.
 */
export const saveCallInsights = createTool({
  description:
    "Save summary, tags, action items, and optional history checkpoints for a single repo call.",
  args: z.object({
    repoId: z.string().describe("Convex id of the repo (as string)."),
    callId: z.string().describe("Convex id of the call (as string)."),
    summary: z
      .string()
      .describe("1–3 sentence summary of what was discussed/decided."),
    tags: z
      .array(z.string())
      .default([])
      .describe("Short labels like 'roadmap', 'infra', 'incident-review'."),
    actionItems: z
      .array(
        z.object({
          description: z
            .string()
            .describe("Concrete follow-up item, prefixed with an imperative verb."),
          status: z
            .enum(["open", "done"])
            .default("open")
            .describe("Whether this item is already completed or still open."),
          filePath: z
            .string()
            .optional()
            .describe("Optional file path mentioned in the item (e.g. 'src/api/user.ts')."),
        }),
      )
      .default([])
      .describe("List of action items discussed in the call."),
    historyCheckpoints: z
      .array(
        z.object({
          title: z.string().describe("Short title for a history checkpoint."),
          description: z
            .string()
            .optional()
            .describe("1–3 sentence description of the milestone/decision."),
          eventAt: z
            .number()
            .optional()
            .describe(
              "Unix timestamp (ms) when this decision roughly happened.",
            ),
        }),
      )
      .default([])
      .describe("Important decisions that should appear in the repo history."),
  }),
  handler: async (
    ctx,
    { repoId, callId, summary, tags, actionItems, historyCheckpoints },
  ): Promise<{ callId: Id<"calls"> }> => {
    const typedRepoId = repoId as Id<"repos">;
    const typedCallId = callId as Id<"calls">;

    // Update the call with summary and tags.
    await ctx.runMutation(api.app.updateCall, {
      callId: typedCallId,
      shortSummary: summary,
      tags,
    });

    // Create call action items.
    for (const item of actionItems) {
      await ctx.runMutation(api.app.createCallActionItem, {
        callId: typedCallId,
        description: item.description,
        status: item.status,
        filePath: item.filePath,
        pullRequestId: undefined,
        repoContributorId: undefined,
      });
    }

    // Create history checkpoints tied to this call.
    const now = Date.now();
    for (const cp of historyCheckpoints) {
      await ctx.runMutation(api.app.createHistoryCheckpoint, {
        repoId: typedRepoId,
        title: cp.title,
        description: cp.description,
        sourceType: "call",
        prAnalysisId: undefined,
        analysisSessionId: undefined,
        callId: typedCallId,
        eventAt: cp.eventAt ?? now,
      });
    }

    return { callId: typedCallId };
  },
});

/**
 * Call Summarizer Agent
 *
 * Given a transcript of a technical call and basic repo context,
 * this agent produces: a concise summary, tags, action items and
 * optional history checkpoints, then calls `saveCallInsights`.
 */
export const callSummarizerAgent = new Agent(components.agent, {
  name: "Call Summarizer",
  languageModel: openai.chat("gpt-4o-mini"),
  instructions: [
    "You are an engineering meeting note-taker and call summarizer.",
    "You will be given JSON describing a single repository call: repo metadata and the full transcript.",
    "Your job is to extract: (1) a concise summary, (2) 0–8 short tags, (3) a small list of concrete action items, and (4) any decisions that deserve history checkpoints.",
    "Then you MUST call the `saveCallInsights` tool EXACTLY ONCE with your structured result.",
    "Be conservative about what counts as a 'decision' worthy of a history checkpoint.",
  ].join(" "),
  tools: {
    saveCallInsights,
  },
  maxSteps: 4,
});
