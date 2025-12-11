import { Agent, createTool } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { api, components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

/**
 * Tool: saveRepoContributorProfile
 *
 * Persist an updated per-repo contributor profile including
 * role, seniority, mainAreas and an optional natural-language
 * profileSummary.
 */
export const saveRepoContributorProfile = createTool({
  description:
    "Save or update the contributor profile for a given repo, including role, seniority, main areas and a short summary.",
  args: z.object({
    repoId: z.string().describe("Convex id of the repo (as string)."),
    contributorId: z
      .string()
      .describe("Convex id of the contributor (as string)."),
    role: z
      .enum(["frontend", "backend", "fullstack", "infra", "data", "other"])
      .optional()
      .describe("Primary role inferred for this contributor in this repo."),
    seniority: z
      .enum(["junior", "mid", "senior", "lead", "principal", "other"])
      .optional()
      .describe("Seniority level inferred for this contributor in this repo."),
    mainAreas: z
      .array(z.string())
      .optional()
      .describe(
        "List of main areas of ownership / focus for this contributor (e.g. 'frontend/ui', 'infra/deploy', 'core/backend').",
      ),
    profileSummary: z
      .string()
      .optional()
      .describe(
        "1–2 sentence natural-language summary of this contributor's role in the repo.",
      ),
  }),
  handler: async (
    ctx,
    {
      repoId,
      contributorId,
      role,
      seniority,
      mainAreas,
      profileSummary,
    },
  ): Promise<{ repoContributorId: Id<"repoContributors"> }> => {
    const id = await ctx.runMutation(api.app.upsertRepoContributor, {
      // The Convex client in tools uses plain string ids; cast to Id here.
      repoId: repoId as Id<"repos">,
      contributorId: contributorId as Id<"contributors">,
      role,
      seniority,
      mainAreas,
      profileSummary,
    });
    return { repoContributorId: id };
  },
});

/**
 * Contributor Profiler Agent
 *
 * Given a JSON summary of a contributor's PRs, affected paths and stats
 * for a single repo, this agent decides on role, seniority and
 * ownership areas, then calls `saveRepoContributorProfile` once.
 */
export const contributorProfilerAgent = new Agent(components.agent, {
  name: "Contributor Profiler",
  languageModel: openai.chat("gpt-4o-mini"),
  instructions: [
    "You profile engineers based on their code contributions in a single repository.",
    "You will be given JSON describing one contributor: their PRs, basic stats and the paths they tend to touch.",
    "Infer: primary role (frontend/backend/fullstack/infra/data/other), seniority (junior/mid/senior/lead/principal/other),",
    "their main areas of ownership (as string labels), and a short 1–2 sentence profile summary.",
    "Then call the `saveRepoContributorProfile` tool exactly once with your inferred values.",
    "When you are unsure, choose 'other' and keep the summary conservative.",
  ].join(" "),
  tools: {
    saveRepoContributorProfile,
  },
  maxSteps: 4,
});
