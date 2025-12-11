import { action, internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { createGithubClient } from "../lib/github";

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
    // Repo was deleted or not yet created; skip syncing for this PR.
    return;
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

// Action: sync all PRs for a single repo from GitHub.
// Uses an app-level GITHUB_TOKEN, suitable for cron / scheduled sync.
export const syncRepoPullRequestsFromGithub = action({
  args: {
    repoId: v.id("repos"),
  },
  handler: async (ctx, { repoId }) => {
    const repo = await ctx.runQuery(api.app.getRepo, { repoId });
    if (!repo) return;

    const token = repo.githubAccessToken;
    if (!token) {
      // No per-repo token configured; skip.
      return;
    }

    // Snapshot of existing PR numbers in Convex so we can detect
    // whether the open-PR set has changed since the last sync.
    const existingPrs = await ctx.runQuery(api.app.listPullRequestsForRepo, {
      repoId,
    });
    const existingNumbers = new Set(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (existingPrs as any[]).map((pr: any) => pr.prNumber as number)
    );

    const github = createGithubClient(token);

    const allPullRequests = await github.listPullRequests(
      repo.repoOwner,
      repo.repoName
    );
    // Only keep open PRs so our Convex view matches GitHub's
    // default open-PR list.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pullRequests = allPullRequests.filter((pr: any) => pr.state === "open");
    const syncedAt = Date.now();

    for (const pr of pullRequests) {
      const fullPr = await github.getPullRequest(
        repo.repoOwner,
        repo.repoName,
        pr.number
      );

      await ctx.runMutation(internal.github.syncPullRequestFromGithub, {
        repo: {
          githubRepoId: repo.githubRepoId,
          owner: repo.repoOwner,
          name: repo.repoName,
          description: repo.description ?? undefined,
          url: repo.url,
          defaultBranch: repo.defaultBranch,
        },
        author: {
          githubUserId: String(fullPr.user?.id ?? ""),
          login: fullPr.user?.login ?? "unknown",
          name: fullPr.user?.name ?? undefined,
          avatarUrl: fullPr.user?.avatar_url ?? undefined,
        },
        pullRequest: {
          githubPrId: String(fullPr.id),
          number: fullPr.number,
          title: fullPr.title ?? "",
          body: fullPr.body ?? undefined,
          state: fullPr.state === "open" ? "open" : "closed",
          merged: Boolean(fullPr.merged_at),
          createdAt: new Date(fullPr.created_at).getTime(),
          mergedAt: fullPr.merged_at
            ? new Date(fullPr.merged_at).getTime()
            : undefined,
          closedAt: fullPr.closed_at
            ? new Date(fullPr.closed_at).getTime()
            : undefined,
        },
        stats: {
          additions: fullPr.additions ?? 0,
          deletions: fullPr.deletions ?? 0,
          changedFiles: fullPr.changed_files ?? 0,
        },
        syncedAt,
      });
    }

    // After syncing open PRs, prune any PR documents that are no longer open.
    const openPrNumbers = pullRequests.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pr: any) => pr.number as number
    );

    await ctx.runMutation(
      internal.github.pruneClosedPullRequestsForRepo,
      { repoId, openPrNumbers }
    );

    // Determine if the open-PR set has changed compared to what we had
    // stored in Convex. Only if it has changed do we kick off a new
    // analysis workflow.
    const openSet = new Set(openPrNumbers);
    let changed = false;

    if (existingNumbers.size !== openSet.size) {
      changed = true;
    } else {
      for (const num of openSet) {
        if (!existingNumbers.has(num)) {
          changed = true;
          break;
        }
      }
      if (!changed) {
        for (const num of existingNumbers) {
          if (!openSet.has(num)) {
            changed = true;
            break;
          }
        }
      }
    }

    if (changed) {
      // Kick off the full analysis workflow for updated PRs, which
      // includes PR analysis, contributor profiling, repo snapshot,
      // and history synthesis.
      await ctx.scheduler.runAfter(0, api.prAgent.runFullAnalysisWorkflow, {
        repoId,
      });
    }
  },
});

// Internal mutation: schedules sync actions for all repos.
export const scheduleGithubSyncAllRepos = internalMutation({
  args: {},
  handler: async (ctx) => {
    const repos = await ctx.db.query("repos").collect();

    for (const repo of repos) {
      await ctx.scheduler.runAfter(
        0,
        api.github.syncRepoPullRequestsFromGithub,
        { repoId: repo._id }
      );
    }
  },
});

// Internal mutation: delete PRs for a repo that are not currently
// open on GitHub (based on PR numbers). This keeps the Convex
// pullRequests table aligned with GitHub's open-PR view.
export const pruneClosedPullRequestsForRepo = internalMutation({
  args: {
    repoId: v.id("repos"),
    openPrNumbers: v.array(v.number()),
  },
  handler: async (ctx, { repoId, openPrNumbers }) => {
    const openSet = new Set(openPrNumbers);

    const prs = await ctx.db
      .query("pullRequests")
      .withIndex("byRepo", (q: any) => q.eq("repoId", repoId))
      .collect();

    for (const pr of prs) {
      if (!openSet.has(pr.prNumber)) {
        await ctx.db.delete(pr._id);
      }
    }
  },
});

