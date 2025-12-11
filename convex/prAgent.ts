import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { createThread, listUIMessages } from "@convex-dev/agent";
import { components } from "./_generated/api";
import { prAnalyzerAgent } from "./agents/PRAnalyzer";
import { syncPullRequestArgs, type SyncPullRequestArgs } from "./github";

/**
 * Create a new thread for the PR Analyzer agent.
 *
 * Use this from the frontend to start a new "conversation" about PRs.
 */
export const createPrAnalyzerThread = mutation({
  args: {
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    // If you have an application-level user id (e.g. Clerk user id),
    // you can thread it through here as a string.
    userId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { title, summary, userId }
  ): Promise<{ threadId: string }> => {
    const threadId = await createThread(ctx, components.agent, {
      userId,
      title: title ?? "PR Analyzer",
      summary: summary ?? undefined,
    });
    return { threadId };
  },
});

/**
 * List UI-friendly messages for a given PR Analyzer thread.
 *
 * This is designed to be used with `useUIMessages` on the frontend,
 * and supports streaming as described in the Convex Agent docs.
 */
export const listPrAnalyzerThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const paginated = await listUIMessages(ctx, components.agent, args);
    return paginated;
  },
});

/**
 * Action: Run the PR Analyzer Agent on a GitHub pull request.
 *
 * This represents a "workflow" step. It:
 * - Ensures there is a thread (creating one if needed)
 * - Instructs the agent to sync the PR into Convex using its tools
 * - Returns the threadId and the assistant text
 */
export const runPrAnalyzerWorkflow = action({
  args: {
    threadId: v.optional(v.string()),
    // Raw GitHub API payloads (trim or shape these as desired in your app).
    repo: v.any(),
    pullRequest: v.any(),
  },
  handler: async (
    ctx,
    { threadId, repo, pullRequest }
  ): Promise<{ threadId: string; text: string }> => {
    const syncedAt = Date.now();

    // Map GitHub payloads into the shape expected by the Agent tool
    // and the underlying Convex mutation.
    const toolArgs: SyncPullRequestArgs = {
      repo: {
        githubRepoId: String(repo.id),
        owner: repo.owner?.login ?? repo.owner ?? "unknown-owner",
        name: repo.name,
        description: repo.description ?? undefined,
        url: repo.html_url,
        defaultBranch: repo.default_branch ?? "main",
      },
      author: {
        githubUserId: String(pullRequest.user?.id ?? pullRequest.user_id),
        login: pullRequest.user?.login ?? pullRequest.user_login ?? "unknown-user",
        name: pullRequest.user?.name ?? undefined,
        avatarUrl: pullRequest.user?.avatar_url ?? undefined,
      },
      pullRequest: {
        githubPrId: String(pullRequest.id),
        number: pullRequest.number,
        title: pullRequest.title,
        body: pullRequest.body ?? undefined,
        state: pullRequest.state === "open" ? "open" : "closed",
        merged: Boolean(pullRequest.merged_at),
        createdAt: new Date(pullRequest.created_at).getTime(),
        mergedAt: pullRequest.merged_at
          ? new Date(pullRequest.merged_at).getTime()
          : undefined,
        closedAt: pullRequest.closed_at
          ? new Date(pullRequest.closed_at).getTime()
          : undefined,
      },
      stats: {
        additions: pullRequest.additions ?? 0,
        deletions: pullRequest.deletions ?? 0,
        changedFiles: pullRequest.changed_files ?? 0,
      },
      syncedAt,
    };

    let effectiveThreadId = threadId;
    if (!effectiveThreadId) {
      effectiveThreadId = await createThread(ctx, components.agent, {
        title: `PR #${toolArgs.pullRequest.number} - ${toolArgs.pullRequest.title}`,
        summary: "GitHub PR analysis thread",
      });
    }

    const prompt = [
      "You are the PR Analyzer Agent.",
      "You are given structured GitHub pull request data.",
      "Call the `syncGithubPullRequest` tool exactly once with the provided JSON arguments to sync this PR into Convex.",
      "Do not invent or modify fields; use them as-is.",
      "Here are the arguments in JSON:",
      JSON.stringify(toolArgs),
    ].join("\n\n");

    const result = await prAnalyzerAgent.generateText(
      ctx,
      { threadId: effectiveThreadId },
      { prompt }
    );

    return { threadId: effectiveThreadId, text: result.text };
  },
});

/**
 * Simple test action for the PR Analyzer Agent.
 *
 * Call this from the Convex dashboard or tests by passing in
 * normalized `SyncPullRequestArgs`. It will:
 * - Create a fresh thread
 * - Ask the agent to sync the PR via its tool
 * - Return the text response and thread id
 *
 * NOTE: For the underlying sync to succeed, there must already be
 * a `repos` row whose `githubRepoId` matches `args.repo.githubRepoId`.
 */
export const testPrAnalyzerAgent = action({
  args: syncPullRequestArgs,
  handler: async (
    ctx,
    args: SyncPullRequestArgs
  ): Promise<{ threadId: string; text: string }> => {
    const threadId = await createThread(ctx, components.agent, {
      title: `Test PR #${args.pullRequest.number}`,
      summary: "Test thread for PR Analyzer Agent",
    });

    const prompt = [
      "You are the PR Analyzer Agent under test.",
      "Call the `syncGithubPullRequest` tool exactly once using the JSON arguments below.",
      "Respond briefly confirming what you synced.",
      JSON.stringify(args),
    ].join("\n\n");

    const result = await prAnalyzerAgent.generateText(
      ctx,
      { threadId },
      { prompt }
    );

    return { threadId, text: result.text };
  },
});

