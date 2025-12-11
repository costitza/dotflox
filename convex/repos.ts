import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

async function getOrCreateUser(ctx: any) {
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
    .withIndex("byExternalAuthId", (q: any) => q.eq("externalAuthId", externalAuthId))
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
}

export const addFromGithub = mutation({
  args: {
    owner: v.string(),
    name: v.string(),
  },
  handler: async (ctx, { owner, name }) => {
    const user = await getOrCreateUser(ctx);

    if (!process.env.GITHUB_TOKEN) {
      throw new Error("GitHub token not configured on the server");
    }

    const { data: repo } = await octokit.repos.get({
      owner,
      repo: name,
    });

    const now = Date.now();
    const githubRepoId = String(repo.id);

    const existing = await ctx.db
      .query("repos")
      .withIndex("byGithubRepoId", (q: any) => q.eq("githubRepoId", githubRepoId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ownerUserId: user._id,
        repoOwner: owner,
        repoName: repo.name,
        description: repo.description ?? existing.description,
        url: repo.html_url,
        defaultBranch: repo.default_branch,
        updatedAt: now,
      });

      return { repoId: existing._id };
    }

    const repoId = await ctx.db.insert("repos", {
      ownerUserId: user._id,
      githubRepoId,
      repoOwner: owner,
      repoName: repo.name,
      description: repo.description ?? undefined,
      url: repo.html_url,
      defaultBranch: repo.default_branch,
      createdAt: now,
      updatedAt: now,
    });

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


