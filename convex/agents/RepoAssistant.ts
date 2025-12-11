import { Agent, createTool } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { api, components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

export const getRepoContext = createTool({
  description:
    "Fetch high-level context about a single repository (metadata, tech stack, and basic stats).",
  args: z.object({
    repoId: z
      .string()
      .describe(
        "Convex document id for the repo (as a string, e.g. 'r123...').",
      ),
  }),
  handler: async (ctx, { repoId }) => {
    const id = repoId as Id<"repos">;

    const repo = await ctx.runQuery(api.app.getRepo, { repoId: id });
    if (!repo) {
      return { exists: false };
    }

    const [techStack, pullRequests, contributors, calls, analyses] =
      await Promise.all([
        ctx.runQuery(api.app.listTechStackItemsForRepo, { repoId: id }),
        ctx.runQuery(api.app.listPullRequestsForRepo, { repoId: id }),
        ctx.runQuery(api.app.listRepoContributorsDetailed, { repoId: id }),
        ctx.runQuery(api.app.listCallsForRepo, { repoId: id }),
        ctx.runQuery(api.app.listAnalysisSessionsForRepo, { repoId: id }),
      ]);

    return {
      exists: true,
      repo: {
        owner: repo.repoOwner,
        name: repo.repoName,
        description: repo.description ?? null,
        defaultBranch: repo.defaultBranch,
        url: repo.url,
      },
      techStack: techStack.map((item) => ({
        name: item.name,
        version: item.version ?? null,
        itemType: item.itemType,
      })),
      stats: {
        prCount: pullRequests.length,
        contributorCount: contributors.length,
        callCount: calls.length,
        analysisCount: analyses.length,
      },
    };
  },
});

export const repoAssistantAgent = new Agent(components.agent, {
  name: "Repository Assistant",
  languageModel: openai.chat("gpt-4o-mini"),
  instructions: [
    "You are an engineering assistant helping developers understand a single repository.",
    "Always use the `getRepoContext` tool to gather context before answering.",
    "Explain architecture, ownership, tech stack, and activity based on what you see.",
    "If the user asks follow-up questions, you can call the tool again if needed.",
    "If something is not available in the database, say that you don't know rather than guessing.",
  ].join(" "),
  tools: {
    getRepoContext,
  },
  maxSteps: 4,
});


