import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    externalAuthId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byExternalAuthId", ["externalAuthId"])
    .index("byEmail", ["email"]),

  repos: defineTable({
    ownerUserId: v.id("users"),

    githubRepoId: v.string(),
    repoOwner: v.string(),
    repoName: v.string(),
    description: v.optional(v.string()),
    url: v.string(),
    defaultBranch: v.string(),

    // Optional per-repo GitHub access token used for
    // background syncs and analysis.
    githubAccessToken: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byOwnerUserId", ["ownerUserId"])
    .index("byGithubRepoId", ["githubRepoId"]),

  contributors: defineTable({
    githubUserId: v.string(),
    login: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byGithubUserId", ["githubUserId"])
    .index("byLogin", ["login"]),

  repoContributors: defineTable({
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

    prCount: v.number(),
    linesChanged: v.number(),
    mainAreas: v.optional(v.array(v.string())),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byRepo", ["repoId"])
    .index("byContributor", ["contributorId"])
    .index("byRepoAndContributor", ["repoId", "contributorId"]),

  pullRequests: defineTable({
    repoId: v.id("repos"),
    authorContributorId: v.id("contributors"),

    githubPrId: v.string(),
    prNumber: v.number(),
    title: v.string(),
    body: v.optional(v.string()),
    status: v.union(
      v.literal("open"),
      v.literal("closed"),
      v.literal("merged")
    ),

    // Optional Convex Agent thread id associated with PRAnalyzerAgent
    // for this pull request (stored in the Agent component's tables).
    prAnalyzerThreadId: v.optional(v.string()),

    createdAt: v.number(),
    mergedAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),

    lastSyncedAt: v.number(),
  })
    .index("byRepo", ["repoId"])
    .index("byRepoAndNumber", ["repoId", "prNumber"])
    .index("byAuthor", ["authorContributorId"]),

  prAnalyses: defineTable({
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

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byRepo", ["repoId"])
    .index("byPullRequest", ["pullRequestId"]),

  prAnalysisContributors: defineTable({
    prAnalysisId: v.id("prAnalyses"),
    contributorId: v.id("contributors"),

    roleHint: v.optional(v.string()),

    createdAt: v.number(),
  })
    .index("byPrAnalysis", ["prAnalysisId"])
    .index("byContributor", ["contributorId"]),

  analysisSessions: defineTable({
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

    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byRepo", ["repoId"])
    .index("byUser", ["userId"]),

  analysisSessionPRs: defineTable({
    analysisSessionId: v.id("analysisSessions"),
    pullRequestId: v.id("pullRequests"),

    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byAnalysisSession", ["analysisSessionId"])
    .index("byPullRequest", ["pullRequestId"]),

  historyCheckpoints: defineTable({
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

    createdAt: v.number(),
  })
    .index("byRepoAndEventAt", ["repoId", "eventAt"])
    .index("byPrAnalysis", ["prAnalysisId"])
    .index("byAnalysisSession", ["analysisSessionId"])
    .index("byCall", ["callId"]),

  calls: defineTable({
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

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byRepo", ["repoId"])
    .index("byUser", ["userId"])
    .index("byStatus", ["status"]),

  callActionItems: defineTable({
    callId: v.id("calls"),

    description: v.string(),
    status: v.union(v.literal("open"), v.literal("done")),

    pullRequestId: v.optional(v.id("pullRequests")),
    repoContributorId: v.optional(v.id("repoContributors")),
    filePath: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byCall", ["callId"])
    .index("byStatus", ["status"])
    .index("byPullRequest", ["pullRequestId"])
    .index("byRepoContributor", ["repoContributorId"]),

  techStackItems: defineTable({
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

    detectedAt: v.number(),
    createdAt: v.number(),
  }).index("byRepo", ["repoId"]),
});