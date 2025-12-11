import { Agent, createTool } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

/**
 * Tool: syncGithubPullRequest
 *
 * Given structured data from the GitHub Pull Request API, upserts:
 * - the author in `contributors`
 * - the PR itself in `pullRequests`
 * - a `repoContributors` link row with basic aggregate stats
 *
 * This delegates actual DB writes to the Convex internal mutation
 * `internal.github.syncPullRequestFromGithub`.
 */
export const syncGithubPullRequest = createTool({
  description:
    "Sync a single GitHub pull request into Convex, updating contributors, pullRequests, and repoContributors tables.",
  args: z.object({
    repo: z
      .object({
        githubRepoId: z
          .string()
          .describe("The GitHub repository id as a string."),
        owner: z.string().describe("The GitHub organization/user login."),
        name: z.string().describe("The repository name."),
        description: z.string().optional().describe("Repository description."),
        url: z
          .string()
          .describe("HTML URL of the repository (e.g. https://github.com/org/repo)."),
        defaultBranch: z
          .string()
          .describe("The repository default branch (e.g. main)."),
      })
      .describe("Metadata for the repository the PR belongs to."),
    author: z
      .object({
        githubUserId: z
          .string()
          .describe("GitHub user id for the PR author, stringified."),
        login: z.string().describe("GitHub username of the PR author."),
        name: z.string().optional().describe("Display name of the PR author."),
        avatarUrl: z
          .string()
          .optional()
          .describe("Avatar URL of the PR author, if available."),
      })
      .describe("Metadata for the author of the PR."),
    pullRequest: z
      .object({
        githubPrId: z.string().describe("GitHub id of the pull request."),
        number: z
          .number()
          .describe("Pull request number within the repository."),
        title: z.string().describe("Title of the pull request."),
        body: z.string().optional().describe("Body/description of the PR."),
        state: z
          .enum(["open", "closed"])
          .describe("Current GitHub state of the PR."),
        merged: z
          .boolean()
          .describe("Whether the PR is merged (true) or not (false)."),
        createdAt: z
          .number()
          .describe(
            "Unix timestamp (ms) when the PR was created. Convert from GitHub's created_at."
          ),
        mergedAt: z
          .number()
          .optional()
          .describe(
            "Unix timestamp (ms) when the PR was merged, if applicable. Convert from GitHub's merged_at."
          ),
        closedAt: z
          .number()
          .optional()
          .describe(
            "Unix timestamp (ms) when the PR was closed, if applicable. Convert from GitHub's closed_at."
          ),
      })
      .describe("Key metadata for the pull request."),
    stats: z
      .object({
        additions: z
          .number()
          .describe("Number of lines added in the PR (GitHub additions)."),
        deletions: z
          .number()
          .describe("Number of lines deleted in the PR (GitHub deletions)."),
        changedFiles: z
          .number()
          .describe("Number of files changed (GitHub changed_files)."),
      })
      .describe("Basic change stats from GitHub."),
    syncedAt: z
      .number()
      .describe(
        "Unix timestamp (ms) when this sync is happening, used for createdAt/updatedAt bookkeeping."
      ),
  }),
  // ToolCtx includes ActionCtx, so we can call ctx.runMutation
  // with functions from the generated Convex API.
  handler: async (
    ctx,
    args
  ): Promise<{
    pullRequestId: Id<"pullRequests">;
    contributorId: Id<"contributors">;
    repoId: Id<"repos">;
  }> => {
    const result = await ctx.runMutation(
      internal.github.syncPullRequestFromGithub,
      args
    );
    return result;
  },
});

/**
 * PRAnalyzer Agent
 *
 * High-level agent that knows how to take GitHub PR data and
 * keep your Convex schema in sync via tools.
 *
 * You can call this from a Convex action, passing GitHub webhook
 * payloads or data fetched from the GitHub REST API, and let the
 * agent decide when to call `syncGithubPullRequest`.
 */
export const prAnalyzerAgent = new Agent(components.agent, {
  name: "Pull Request Analyzer",
  languageModel: openai.chat("gpt-4o-mini"),
  instructions: [
    "You are an expert GitHub pull request ingestion agent.",
    "You are given structured data from the GitHub API for a single pull request.",
    "Your job is to keep the Convex database in sync with that PR by calling tools.",
    "Always use the `syncGithubPullRequest` tool once per PR to upsert it into the database.",
    "Do not invent data; only use fields that are provided to you.",
  ].join(" "),
  tools: {
    syncGithubPullRequest,
  },
  maxSteps: 3,
});

