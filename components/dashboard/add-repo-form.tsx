"use client";

import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";

type AddRepoFormProps = {
  onAdded?: () => void;
};

export function AddRepoForm({ onAdded }: AddRepoFormProps) {
  const addRepo = useMutation(api.repos.addFromGithub);
  const [owner, setOwner] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmedOwner = owner.trim();
    const trimmedName = name.trim();

    if (!trimmedOwner || !trimmedName) {
      setError("Please provide both the GitHub owner and repository name.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/github-token");
      if (!res.ok) {
        throw new Error(
          res.status === 404
            ? "No GitHub OAuth token found. Make sure you've connected GitHub in Clerk."
            : "Failed to retrieve GitHub OAuth token."
        );
      }
      const { token } = (await res.json()) as { token: string };

      await addRepo({
        owner: trimmedOwner,
        name: trimmedName,
        githubAccessToken: token,
      });
      setOwner("");
      setName("");
      setIsSubmitting(false);
      onAdded?.();
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to add repository from GitHub. Please try again.";
      setError(message);
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">
            GitHub owner
          </label>
          <input
            type="text"
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            placeholder="e.g. octocat"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700">
            Repository name
          </label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. hello-world"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500">
          We use the GitHub API via Octokit to validate and fetch repository
          details.
        </p>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-9 rounded-full bg-[#2563eb] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#1d4ed8] disabled:opacity-60"
        >
          {isSubmitting ? "Adding…" : "Add from GitHub"}
        </Button>
      </div>

      {error && (
        <p className="text-[11px] font-medium text-rose-600">{error}</p>
      )}
    </form>
  );
}


