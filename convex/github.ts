import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";

// Shared validator for syncing a GitHub pull request into Convex.
// Re-use this for both the internal mutation (used by the Agent tool)
// and for public mutations/actions so they all accept the same shape.
export const syncPullRequestArgs = {
  repo: v.object({
    githubRepoId: v.string(),
    owner: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    url: v.string(),
    defaultBranch: v.string(),
  }),
  author: v.object({
    githubUserId: v.string(),
    login: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  }),
  pullRequest: v.object({
    githubPrId: v.string(),
    number: v.number(),
    title: v.string(),
    body: v.optional(v.string()),
    state: v.union(v.literal("open"), v.literal("closed")),
    merged: v.boolean(),
    createdAt: v.number(),
    mergedAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),
  }),
  stats: v.object({
    additions: v.number(),
    deletions: v.number(),
    changedFiles: v.number(),
  }),
  syncedAt: v.number(),
} as const;

export type SyncPullRequestArgs = {
  repo: {
    githubRepoId: string;
    owner: string;
    name: string;
    description?: string;
    url: string;
    defaultBranch: string;
  };
  author: {
    githubUserId: string;
    login: string;
    name?: string;
    avatarUrl?: string;
  };
  pullRequest: {
    githubPrId: string;
    number: number;
    title: string;
    body?: string;
    state: "open" | "closed";
    merged: boolean;
    createdAt: number;
    mergedAt?: number;
    closedAt?: number;
  };
  stats: {
    additions: number;
    deletions: number;
    changedFiles: number;
  };
  syncedAt: number;
};

async function syncPullRequestCore(ctx: any, args: SyncPullRequestArgs) {
  const { repo, author, pullRequest, stats, syncedAt } = args;

  const repoRow = await ctx.db
    .query("repos")
    .withIndex("byGithubRepoId", (q: any) => q.eq("githubRepoId", repo.githubRepoId))
    .unique();

  if (!repoRow) {
    throw new Error(
      `No repo found for githubRepoId=${repo.githubRepoId}. Create the repo row before syncing PRs.`
    );
  }

  let contributor = await ctx.db
    .query("contributors")
    .withIndex("byGithubUserId", (q: any) => q.eq("githubUserId", author.githubUserId))
    .unique();

  if (!contributor) {
    const contributorId = await ctx.db.insert("contributors", {
      githubUserId: author.githubUserId,
      login: author.login,
      name: author.name,
      avatarUrl: author.avatarUrl,
      createdAt: syncedAt,
      updatedAt: syncedAt,
    });
    contributor = await ctx.db.get(contributorId);
  } else {
    await ctx.db.patch(contributor._id, {
      login: author.login,
      name: author.name ?? contributor.name,
      avatarUrl: author.avatarUrl ?? contributor.avatarUrl,
      updatedAt: syncedAt,
    });
  }

  if (!contributor) {
    throw new Error("Failed to load or create contributor");
  }

  const existingPr = await ctx.db
    .query("pullRequests")
    .withIndex("byRepoAndNumber", (q: any) =>
      q.eq("repoId", repoRow._id).eq("prNumber", pullRequest.number)
    )
    .unique();

  const status =
    pullRequest.merged === true
      ? "merged"
      : pullRequest.state === "open"
        ? "open"
        : "closed";

  const basePrDoc = {
    repoId: repoRow._id,
    authorContributorId: contributor._id,
    githubPrId: pullRequest.githubPrId,
    prNumber: pullRequest.number,
    title: pullRequest.title,
    body: pullRequest.body,
    status,
    createdAt: pullRequest.createdAt,
    mergedAt: pullRequest.mergedAt,
    closedAt: pullRequest.closedAt,
    lastSyncedAt: syncedAt,
  } as const;

  let pullRequestId;
  if (!existingPr) {
    pullRequestId = await ctx.db.insert("pullRequests", basePrDoc);
  } else {
    await ctx.db.patch(existingPr._id, basePrDoc);
    pullRequestId = existingPr._id;
  }

  let repoContributor = await ctx.db
    .query("repoContributors")
    .withIndex("byRepoAndContributor", (q: any) =>
      q.eq("repoId", repoRow._id).eq("contributorId", contributor._id)
    )
    .unique();

  if (!repoContributor) {
    const prCount = await ctx.db
      .query("pullRequests")
      .withIndex("byAuthor", (q: any) =>
        q.eq("authorContributorId", contributor._id)
      )
      .collect()
      .then((prs: any[]) => prs.length);

    await ctx.db.insert("repoContributors", {
      repoId: repoRow._id,
      contributorId: contributor._id,
      role: undefined,
      seniority: undefined,
      prCount,
      linesChanged: stats.additions + stats.deletions,
      mainAreas: undefined,
      createdAt: syncedAt,
      updatedAt: syncedAt,
    });
  } else {
    const prCount = await ctx.db
      .query("pullRequests")
      .withIndex("byAuthor", (q: any) =>
        q.eq("authorContributorId", contributor._id)
      )
      .collect()
      .then((prs: any[]) => prs.length);

    await ctx.db.patch(repoContributor._id, {
      prCount,
      linesChanged: stats.additions + stats.deletions,
      updatedAt: syncedAt,
    });
  }

  return { pullRequestId, contributorId: contributor._id, repoId: repoRow._id };
}

// Internal-only entrypoint used by the Agent tool
export const syncPullRequestFromGithub = internalMutation({
  args: syncPullRequestArgs,
  handler: async (ctx, args) => syncPullRequestCore(ctx, args),
});

// Public mutation you can call from your app / webhooks directly
export const syncPullRequestFromGithubMutation = mutation({
  args: syncPullRequestArgs,
  handler: async (ctx, args) => syncPullRequestCore(ctx, args),
});

