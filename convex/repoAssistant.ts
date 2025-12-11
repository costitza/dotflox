import { action } from "./_generated/server";
import { v } from "convex/values";
import { createThread } from "@convex-dev/agent";
import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { repoAssistantAgent } from "./agents/RepoAssistant";

export const askRepoAssistant = action({
  args: {
    repoId: v.id("repos"),
    question: v.string(),
    threadId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    {
      repoId,
      question,
      threadId,
    }: { repoId: Id<"repos">; question: string; threadId?: string },
  ): Promise<{ threadId: string; text: string }> => {
    let effectiveThreadId = threadId;

    if (!effectiveThreadId) {
      effectiveThreadId = await createThread(ctx, components.agent, {
        title: `Repo assistant: ${repoId}`,
        summary: "Voice conversation about a single repository.",
      });
    }

    const prompt = [
      "You are helping a developer understand a repository stored in Convex.",
      "Use the `getRepoContext` tool to inspect the repository and then answer the question clearly.",
      `Repository id: ${repoId}`,
      `User question: ${question}`,
    ].join("\n\n");

    const result = await repoAssistantAgent.generateText(
      ctx,
      { threadId: effectiveThreadId },
      { prompt },
    );

    return { threadId: effectiveThreadId, text: result.text };
  },
});


