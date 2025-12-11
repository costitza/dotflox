import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "sync github pull requests for all repos",
  { seconds: 5 },
  internal.github.scheduleGithubSyncAllRepos,
  {}
);

export default crons;

