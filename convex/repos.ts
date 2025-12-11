import { action, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { createGithubClient } from "../lib/github";

export const getOrCreateUser = internalMutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const externalAuthId = identity.subject;
    const email = identity.email ?? "unknown@example.com";
    const name =
      identity.name ?? identity.givenName ?? identity.familyName ?? undefined;

    let user = await ctx.db
      .query("users")
      .withIndex("byExternalAuthId", (q: any) =>
        q.eq("externalAuthId", externalAuthId)
      )
      .unique();

    const now = Date.now();

    if (!user) {
      const userId = await ctx.db.insert("users", {
        externalAuthId,
        email,
        name,
        createdAt: now,
        updatedAt: now,
      });
      user = await ctx.db.get(userId);
    } else {
      await ctx.db.patch(user._id, {
        email: email || user.email,
        name: name ?? user.name,
        updatedAt: now,
      });
    }

    if (!user) {
      throw new Error("Failed to load or create user");
    }

    return user;
  },
});

export const saveGithubRepo = internalMutation({
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
      .withIndex("byGithubRepoId", (q: any) => q.eq("githubRepoId", args.githubRepoId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ownerUserId: args.ownerUserId,
        repoOwner: args.repoOwner,
        repoName: args.repoName,
        description: args.description ?? existing.description,
        url: args.url,
        defaultBranch: args.defaultBranch,
        updatedAt: now,
      });
      return { repoId: existing._id };
    }

    const repoId = await ctx.db.insert("repos", {
      ownerUserId: args.ownerUserId,
      githubRepoId: args.githubRepoId,
      repoOwner: args.repoOwner,
      repoName: args.repoName,
      description: args.description ?? undefined,
      url: args.url,
      defaultBranch: args.defaultBranch,
      createdAt: now,
      updatedAt: now,
    });

    return { repoId };
  },
});

export const addFromGithub = action({
  args: {
    owner: v.string(),
    name: v.string(),
    githubAccessToken: v.string(),
  },
  handler: async (ctx, { owner, name, githubAccessToken }) => {
    const user = await ctx.runMutation(internal.repos.getOrCreateUser, {});

    const github = createGithubClient(githubAccessToken);

    const repoData = await github.getRepo(owner, name);
    const githubRepoId = String(repoData.id);

    const { repoId } = await ctx.runMutation(internal.repos.saveGithubRepo, {
      ownerUserId: user._id,
      githubRepoId,
      repoOwner: (repoData.owner as any)?.login ?? owner,
      repoName: repoData.name,
      description: repoData.description ?? undefined,
      url: repoData.html_url,
      defaultBranch: repoData.default_branch,
    });

    const pullRequests = await github.listPullRequests(owner, name);
    const syncedAt = Date.now();

    for (const pr of pullRequests) {
      const fullPr = await github.getPullRequest(owner, name, pr.number);

      await ctx.runMutation(internal.github.syncPullRequestFromGithub, {
        repo: {
          githubRepoId,
          owner,
          name: repoData.name,
          description: repoData.description ?? undefined,
          url: repoData.html_url,
          defaultBranch: repoData.default_branch,
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

    return { repoId };
  },
});

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return [];
    }

    const externalAuthId = identity.subject;

    const user = await ctx.db
      .query("users")
      .withIndex("byExternalAuthId", (q: any) =>
        q.eq("externalAuthId", externalAuthId),
      )
      .unique();

    if (!user) {
      return [];
    }

    const repos = await ctx.db
      .query("repos")
      .withIndex("byOwnerUserId", (q: any) => q.eq("ownerUserId", user._id))
      .collect();

    return repos;
  },
});


