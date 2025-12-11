import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * USERS
 */

export const getUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return ctx.db.get(userId);
  },
});

export const getUserByExternalAuthId = query({
  args: { externalAuthId: v.string() },
  handler: async (ctx, { externalAuthId }) => {
    return ctx.db
      .query("users")
      .withIndex("byExternalAuthId", (q) => q.eq("externalAuthId", externalAuthId))
      .unique();
  },
});

export const upsertUser = mutation({
  args: {
    externalAuthId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { externalAuthId, email, name }) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("users")
      .withIndex("byExternalAuthId", (q) => q.eq("externalAuthId", externalAuthId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email,
        name: name ?? existing.name,
        updatedAt: now,
      });
      return existing._id;
    }

    return ctx.db.insert("users", {
      externalAuthId,
      email,
      name,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * REPOS
 */

export const getRepo = query({
  args: { repoId: v.id("repos") },
  handler: async (ctx, { repoId }) => ctx.db.get(repoId),
});

export const getRepoByGithubRepoId = query({
  args: { githubRepoId: v.string() },
  handler: async (ctx, { githubRepoId }) => {
    return ctx.db
      .query("repos")
      .withIndex("byGithubRepoId", (q) => q.eq("githubRepoId", githubRepoId))
      .unique();
  },
});

export const listReposForUser = query({
  args: { ownerUserId: v.id("users") },
  handler: async (ctx, { ownerUserId }) => {
    return ctx.db
      .query("repos")
      .withIndex("byOwnerUserId", (q) => q.eq("ownerUserId", ownerUserId))
      .collect();
  },
});

export const upsertRepo = mutation({
  args: {
    ownerUserId: v.id("users"),
    githubRepoId: v.string(),
    repoOwner: v.string(),
    repoName: v.string(),
    description: v.optional(v.string()),
    url: v.string(),
    defaultBranch: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("repos")
      .withIndex("byGithubRepoId", (q) => q.eq("githubRepoId", args.githubRepoId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ownerUserId: args.ownerUserId,
        repoOwner: args.repoOwner,
        repoName: args.repoName,
        description: args.description ?? existing.description,
        url: args.url,
        defaultBranch: args.defaultBranch,
        // Keep any existing GitHub access token; this helper is
        // for general repo metadata updates, not auth changes.
        updatedAt: now,
      });
      return existing._id;
    }

    return ctx.db.insert("repos", {
      ...args,
      githubAccessToken: undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const deleteRepoAndData = mutation({
  args: { repoId: v.id("repos") },
  handler: async (ctx, { repoId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("byExternalAuthId", (q) =>
        q.eq("externalAuthId", identity.subject)
      )
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const repo = await ctx.db.get(repoId);
    if (!repo) {
      return;
    }

    if (repo.ownerUserId !== user._id) {
      throw new Error("Not authorized to delete this repo");
    }

    // Delete analysis sessions and their PR links
    const sessions = await ctx.db
      .query("analysisSessions")
      .withIndex("byRepo", (q) => q.eq("repoId", repoId))
      .collect();
    for (const session of sessions) {
      const sessionPRs = await ctx.db
        .query("analysisSessionPRs")
        .withIndex("byAnalysisSession", (q) =>
          q.eq("analysisSessionId", session._id)
        )
        .collect();
      for (const spr of sessionPRs) {
        await ctx.db.delete(spr._id);
      }
      await ctx.db.delete(session._id);
    }

    // Delete PR analyses and their contributor links
    const prAnalysesForRepo = await ctx.db
      .query("prAnalyses")
      .withIndex("byRepo", (q) => q.eq("repoId", repoId))
      .collect();
    for (const analysis of prAnalysesForRepo) {
      const links = await ctx.db
        .query("prAnalysisContributors")
        .withIndex("byPrAnalysis", (q) =>
          q.eq("prAnalysisId", analysis._id)
        )
        .collect();
      for (const link of links) {
        await ctx.db.delete(link._id);
      }
      await ctx.db.delete(analysis._id);
    }

    // Delete history checkpoints
    const history = await ctx.db
      .query("historyCheckpoints")
      .withIndex("byRepoAndEventAt", (q) => q.eq("repoId", repoId))
      .collect();
    for (const h of history) {
      await ctx.db.delete(h._id);
    }

    // Delete calls and their action items
    const calls = await ctx.db
      .query("calls")
      .withIndex("byRepo", (q) => q.eq("repoId", repoId))
      .collect();
    for (const call of calls) {
      const items = await ctx.db
        .query("callActionItems")
        .withIndex("byCall", (q) => q.eq("callId", call._id))
        .collect();
      for (const item of items) {
        await ctx.db.delete(item._id);
      }
      await ctx.db.delete(call._id);
    }

    // Delete call action items that may reference this repo via PRs or contributors
    const prsForRepo = await ctx.db
      .query("pullRequests")
      .withIndex("byRepo", (q) => q.eq("repoId", repoId))
      .collect();
    for (const pr of prsForRepo) {
      const itemsByPr = await ctx.db
        .query("callActionItems")
        .withIndex("byPullRequest", (q) =>
          q.eq("pullRequestId", pr._id)
        )
        .collect();
      for (const item of itemsByPr) {
        await ctx.db.delete(item._id);
      }

      // Delete analysisSessionPRs referencing this PR
      const sessionPRsByPr = await ctx.db
        .query("analysisSessionPRs")
        .withIndex("byPullRequest", (q) =>
          q.eq("pullRequestId", pr._id)
        )
        .collect();
      for (const spr of sessionPRsByPr) {
        await ctx.db.delete(spr._id);
      }

      await ctx.db.delete(pr._id);
    }

    // Delete repo contributor links and any action items tied to them
    const repoContributors = await ctx.db
      .query("repoContributors")
      .withIndex("byRepo", (q) => q.eq("repoId", repoId))
      .collect();
    for (const rc of repoContributors) {
      const itemsByRc = await ctx.db
        .query("callActionItems")
        .withIndex("byRepoContributor", (q) =>
          q.eq("repoContributorId", rc._id)
        )
        .collect();
      for (const item of itemsByRc) {
        await ctx.db.delete(item._id);
      }
      await ctx.db.delete(rc._id);
    }

    // Delete tech stack items
    const techItems = await ctx.db
      .query("techStackItems")
      .withIndex("byRepo", (q) => q.eq("repoId", repoId))
      .collect();
    for (const item of techItems) {
      await ctx.db.delete(item._id);
    }

    // Finally delete the repo itself
    await ctx.db.delete(repoId);
  },
});

/**
 * CONTRIBUTORS & REPO CONTRIBUTORS
 */

export const getContributor = query({
  args: { contributorId: v.id("contributors") },
  handler: async (ctx, { contributorId }) => ctx.db.get(contributorId),
});

export const getContributorByGithubUserId = query({
  args: { githubUserId: v.string() },
  handler: async (ctx, { githubUserId }) => {
    return ctx.db
      .query("contributors")
      .withIndex("byGithubUserId", (q) => q.eq("githubUserId", githubUserId))
      .unique();
  },
});

export const listContributorsForRepo = query({
  args: { repoId: v.id("repos") },
  handler: async (ctx, { repoId }) => {
    const links = await ctx.db
      .query("repoContributors")
      .withIndex("byRepo", (q) => q.eq("repoId", repoId))
      .collect();
    const contributors = await Promise.all(
      links.map((link) => ctx.db.get(link.contributorId))
    );
    return contributors.filter((c): c is NonNullable<typeof c> => c !== null);
  },
});

export const listRepoContributorsDetailed = query({
  args: { repoId: v.id("repos") },
  handler: async (ctx, { repoId }) => {
    const links = await ctx.db
      .query("repoContributors")
      .withIndex("byRepo", (q) => q.eq("repoId", repoId))
      .collect();

    const contributors = await Promise.all(
      links.map((link) => ctx.db.get(link.contributorId))
    );

    return links
      .map((link, index) =>
        contributors[index]
          ? {
              repoContributor: link,
              contributor: contributors[index]!,
            }
          : null
      )
      .filter(
        (
          x
        ): x is {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          repoContributor: any;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          contributor: any;
        } => x !== null
      );
  },
});

export const upsertContributor = mutation({
  args: {
    githubUserId: v.string(),
    login: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("contributors")
      .withIndex("byGithubUserId", (q) => q.eq("githubUserId", args.githubUserId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        login: args.login,
        name: args.name ?? existing.name,
        avatarUrl: args.avatarUrl ?? existing.avatarUrl,
        updatedAt: now,
      });
      return existing._id;
    }

    return ctx.db.insert("contributors", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const upsertRepoContributor = mutation({
  args: {
    repoId: v.id("repos"),
    contributorId: v.id("contributors"),
    role: v.optional(
      v.union(
        v.literal("frontend"),
        v.literal("backend"),
        v.literal("fullstack"),
        v.literal("infra"),
        v.literal("data"),
        v.literal("other")
      )
    ),
    seniority: v.optional(
      v.union(
        v.literal("junior"),
        v.literal("mid"),
        v.literal("senior"),
        v.literal("lead"),
        v.literal("principal"),
        v.literal("other")
      )
    ),
    mainAreas: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("repoContributors")
      .withIndex("byRepoAndContributor", (q) =>
        q.eq("repoId", args.repoId).eq("contributorId", args.contributorId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        role: args.role,
        seniority: args.seniority,
        mainAreas: args.mainAreas ?? existing.mainAreas,
        updatedAt: now,
      });
      return existing._id;
    }

    return ctx.db.insert("repoContributors", {
      repoId: args.repoId,
      contributorId: args.contributorId,
      role: args.role,
      seniority: args.seniority,
      prCount: 0,
      linesChanged: 0,
      mainAreas: args.mainAreas,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * PULL REQUESTS
 */

export const getPullRequest = query({
  args: { pullRequestId: v.id("pullRequests") },
  handler: async (ctx, { pullRequestId }) => ctx.db.get(pullRequestId),
});

export const listPullRequestsForRepo = query({
  args: { repoId: v.id("repos") },
  handler: async (ctx, { repoId }) => {
    return ctx.db
      .query("pullRequests")
      .withIndex("byRepo", (q) => q.eq("repoId", repoId))
      .collect();
  },
});

export const getPullRequestByNumber = query({
  args: { repoId: v.id("repos"), prNumber: v.number() },
  handler: async (ctx, { repoId, prNumber }) => {
    return ctx.db
      .query("pullRequests")
      .withIndex("byRepoAndNumber", (q) =>
        q.eq("repoId", repoId).eq("prNumber", prNumber)
      )
      .unique();
  },
});

export const setPullRequestThreadId = mutation({
  args: {
    pullRequestId: v.id("pullRequests"),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, { pullRequestId, threadId }) => {
    await ctx.db.patch(pullRequestId, { prAnalyzerThreadId: threadId });
  },
});

/**
 * PR ANALYSES & CONTRIBUTORS
 */

export const getPrAnalysis = query({
  args: { prAnalysisId: v.id("prAnalyses") },
  handler: async (ctx, { prAnalysisId }) => ctx.db.get(prAnalysisId),
});

export const listPrAnalysesForPullRequest = query({
  args: { pullRequestId: v.id("pullRequests") },
  handler: async (ctx, { pullRequestId }) => {
    return ctx.db
      .query("prAnalyses")
      .withIndex("byPullRequest", (q) => q.eq("pullRequestId", pullRequestId))
      .collect();
  },
});

export const listPrAnalysesForRepo = query({
  args: { repoId: v.id("repos") },
  handler: async (ctx, { repoId }) => {
    return ctx.db
      .query("prAnalyses")
      .withIndex("byRepo", (q) => q.eq("repoId", repoId))
      .collect();
  },
});

export const createPrAnalysis = mutation({
  args: {
    repoId: v.id("repos"),
    pullRequestId: v.id("pullRequests"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    summary: v.optional(v.string()),
    filesChanged: v.optional(v.array(v.string())),
    impactedPaths: v.optional(v.array(v.string())),
    riskLevel: v.optional(
      v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("critical")
      )
    ),
    rawMetadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return ctx.db.insert("prAnalyses", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updatePrAnalysisDetails = mutation({
  args: {
    prAnalysisId: v.id("prAnalyses"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    summary: v.optional(v.string()),
    filesChanged: v.optional(v.array(v.string())),
    impactedPaths: v.optional(v.array(v.string())),
    riskLevel: v.optional(
      v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("critical")
      )
    ),
    rawMetadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { prAnalysisId, ...patch } = args;
    await ctx.db.patch(prAnalysisId, {
      ...patch,
      updatedAt: Date.now(),
    });
  },
});

export const updatePrAnalysisStatus = mutation({
  args: {
    prAnalysisId: v.id("prAnalyses"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, { prAnalysisId, status }) => {
    await ctx.db.patch(prAnalysisId, { status, updatedAt: Date.now() });
  },
});

export const listPrAnalysisContributors = query({
  args: { prAnalysisId: v.id("prAnalyses") },
  handler: async (ctx, { prAnalysisId }) => {
    return ctx.db
      .query("prAnalysisContributors")
      .withIndex("byPrAnalysis", (q) => q.eq("prAnalysisId", prAnalysisId))
      .collect();
  },
});

export const addPrAnalysisContributor = mutation({
  args: {
    prAnalysisId: v.id("prAnalyses"),
    contributorId: v.id("contributors"),
    roleHint: v.optional(v.string()),
  },
  handler: async (ctx, { prAnalysisId, contributorId, roleHint }) => {
    const now = Date.now();
    return ctx.db.insert("prAnalysisContributors", {
      prAnalysisId,
      contributorId,
      roleHint,
      createdAt: now,
    });
  },
});

/**
 * ANALYSIS SESSIONS & SESSION PRs
 */

export const getAnalysisSession = query({
  args: { analysisSessionId: v.id("analysisSessions") },
  handler: async (ctx, { analysisSessionId }) => ctx.db.get(analysisSessionId),
});

export const listAnalysisSessionsForRepo = query({
  args: { repoId: v.id("repos") },
  handler: async (ctx, { repoId }) => {
    return ctx.db
      .query("analysisSessions")
      .withIndex("byRepo", (q) => q.eq("repoId", repoId))
      .collect();
  },
});

export const createAnalysisSession = mutation({
  args: {
    repoId: v.id("repos"),
    userId: v.id("users"),
    sessionType: v.union(
      v.literal("pr_auto"),
      v.literal("manual_snapshot"),
      v.literal("full_repo"),
      v.literal("other")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    config: v.optional(v.any()),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return ctx.db.insert("analysisSessions", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateAnalysisSessionStatus = mutation({
  args: {
    analysisSessionId: v.id("analysisSessions"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, { analysisSessionId, status, startedAt, completedAt }) => {
    await ctx.db.patch(analysisSessionId, {
      status,
      startedAt,
      completedAt,
      updatedAt: Date.now(),
    });
  },
});

export const listAnalysisSessionPRs = query({
  args: { analysisSessionId: v.id("analysisSessions") },
  handler: async (ctx, { analysisSessionId }) => {
    return ctx.db
      .query("analysisSessionPRs")
      .withIndex("byAnalysisSession", (q) =>
        q.eq("analysisSessionId", analysisSessionId)
      )
      .collect();
  },
});

export const addAnalysisSessionPR = mutation({
  args: {
    analysisSessionId: v.id("analysisSessions"),
    pullRequestId: v.id("pullRequests"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return ctx.db.insert("analysisSessionPRs", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * HISTORY CHECKPOINTS
 */

export const listHistoryCheckpointsForRepo = query({
  args: { repoId: v.id("repos") },
  handler: async (ctx, { repoId }) => {
    return ctx.db
      .query("historyCheckpoints")
      .withIndex("byRepoAndEventAt", (q) => q.eq("repoId", repoId))
      .collect();
  },
});

export const createHistoryCheckpoint = mutation({
  args: {
    repoId: v.id("repos"),
    title: v.string(),
    description: v.optional(v.string()),
    sourceType: v.union(
      v.literal("pr_analysis"),
      v.literal("analysis_session"),
      v.literal("call"),
      v.literal("manual")
    ),
    prAnalysisId: v.optional(v.id("prAnalyses")),
    analysisSessionId: v.optional(v.id("analysisSessions")),
    callId: v.optional(v.id("calls")),
    eventAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return ctx.db.insert("historyCheckpoints", {
      ...args,
      createdAt: now,
    });
  },
});

/**
 * CALLS & ACTION ITEMS
 */

export const getCall = query({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => ctx.db.get(callId),
});

export const listCallsForRepo = query({
  args: { repoId: v.id("repos") },
  handler: async (ctx, { repoId }) => {
    return ctx.db
      .query("calls")
      .withIndex("byRepo", (q) => q.eq("repoId", repoId))
      .collect();
  },
});

export const createCall = mutation({
  args: {
    repoId: v.id("repos"),
    userId: v.id("users"),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    startTime: v.number(),
    endTime: v.optional(v.number()),
    durationSeconds: v.optional(v.number()),
    shortSummary: v.optional(v.string()),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return ctx.db.insert("calls", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateCall = mutation({
  args: {
    callId: v.id("calls"),
    status: v.optional(
      v.union(
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
    endTime: v.optional(v.number()),
    durationSeconds: v.optional(v.number()),
    shortSummary: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { callId, ...patch } = args;
    await ctx.db.patch(callId, {
      ...patch,
      updatedAt: Date.now(),
    });
  },
});

export const listCallActionItems = query({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    return ctx.db
      .query("callActionItems")
      .withIndex("byCall", (q) => q.eq("callId", callId))
      .collect();
  },
});

export const createCallActionItem = mutation({
  args: {
    callId: v.id("calls"),
    description: v.string(),
    status: v.union(v.literal("open"), v.literal("done")),
    pullRequestId: v.optional(v.id("pullRequests")),
    repoContributorId: v.optional(v.id("repoContributors")),
    filePath: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return ctx.db.insert("callActionItems", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateCallActionItemStatus = mutation({
  args: {
    actionItemId: v.id("callActionItems"),
    status: v.union(v.literal("open"), v.literal("done")),
  },
  handler: async (ctx, { actionItemId, status }) => {
    await ctx.db.patch(actionItemId, { status, updatedAt: Date.now() });
  },
});

/**
 * TECH STACK ITEMS
 */

export const listTechStackItemsForRepo = query({
  args: { repoId: v.id("repos") },
  handler: async (ctx, { repoId }) => {
    return ctx.db
      .query("techStackItems")
      .withIndex("byRepo", (q) => q.eq("repoId", repoId))
      .collect();
  },
});

export const upsertTechStackItem = mutation({
  args: {
    repoId: v.id("repos"),
    itemType: v.union(
      v.literal("language"),
      v.literal("framework"),
      v.literal("library"),
      v.literal("database"),
      v.literal("infrastructure"),
      v.literal("tooling")
    ),
    name: v.string(),
    version: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("techStackItems")
      .withIndex("byRepo", (q) => q.eq("repoId", args.repoId))
      .filter((q) =>
        q.and(
          q.eq(q.field("itemType"), args.itemType),
          q.eq(q.field("name"), args.name)
        )
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        version: args.version ?? existing.version,
        metadata: args.metadata ?? existing.metadata,
        detectedAt: now,
        createdAt: existing.createdAt,
      });
      return existing._id;
    }

    return ctx.db.insert("techStackItems", {
      ...args,
      detectedAt: now,
      createdAt: now,
    });
  },
});

