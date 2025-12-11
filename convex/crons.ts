import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "sync github pull requests for all repos",
  { minutes: 1 },
  internal.github.scheduleGithubSyncAllRepos,
  {}
);

export default crons;

