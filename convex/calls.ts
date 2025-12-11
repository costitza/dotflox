import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { callSummarizerAgent } from "./agents/CallSummarizer";

export const startCallSession = action({
  args: { repoId: v.id("repos") },
  handler: async (
    ctx,
    { repoId },
  ): Promise<{ callId: Id<"calls"> }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Upsert the Convex user for this external identity.
    const userId = await ctx.runMutation(api.app.upsertUser, {
      externalAuthId: identity.subject,
      email: identity.email ?? "unknown@example.com",
      name:
        identity.name ??
        identity.givenName ??
        identity.familyName ??
        undefined,
    });

    const callId = await ctx.runMutation(api.app.createCall, {
      repoId,
      userId,
      status: "running",
      startTime: Date.now(),
      endTime: undefined,
      durationSeconds: undefined,
      shortSummary: undefined,
      tags: [],
    });

    return { callId };
  },
});

export const finishCallSession = action({
  args: {
    repoId: v.id("repos"),
    callId: v.id("calls"),
    transcript: v.string(),
  },
  handler: async (
    ctx,
    { repoId, callId, transcript },
  ): Promise<{ summary: string | null; tags: string[] }> => {
    const repo = await ctx.runQuery(api.app.getRepo, { repoId });
    if (!repo) return { summary: null, tags: [] };

    const call = await ctx.runQuery(api.app.getCall, { callId });
    const pullRequests = await ctx.runQuery(api.app.listPullRequestsForRepo, {
      repoId,
    });

    const callInput = {
      repoId: String(repoId),
      callId: String(callId),
      repo: {
        owner: repo.repoOwner,
        name: repo.repoName,
        description: repo.description ?? null,
        url: repo.url,
      },
      call: {
        startedAt: call?.startTime ?? null,
        status: call?.status ?? "running",
      },
      pullRequests: (pullRequests ?? []).map((pr: any) => ({
        prNumber: pr.prNumber,
        title: pr.title,
        status: pr.status,
      })),
      transcript,
    };

    const prompt = [
      "You are the Call Summarizer agent.",
      "You are given JSON describing a single engineering call for a repository.",
      "Use the transcript and context to derive a short summary, useful tags, concrete action items, and any noteworthy decisions.",
      "",
      "CRITICAL: When you are ready, call the `saveCallInsights` tool EXACTLY ONCE",
      "using the provided `repoId` and `callId` fields from the JSON below.",
      "Do not invent ids; use them as-is.",
      "",
      "Here is the input JSON:",
      JSON.stringify(callInput),
    ].join("\n\n");

    await callSummarizerAgent.generateText(
      ctx,
      { userId: String(repo.ownerUserId) },
      { prompt },
    );

    const now = Date.now();
    const durationSeconds =
      call?.startTime != null
        ? Math.round((now - call.startTime) / 1000)
        : undefined;

    await ctx.runMutation(api.app.updateCall, {
      callId,
      status: "completed",
      endTime: now,
      durationSeconds,
    });

    const updated = await ctx.runQuery(api.app.getCall, { callId });

    return {
      summary: updated?.shortSummary ?? null,
      tags: updated?.tags ?? [],
    };
  },
});
