import { Octokit } from "@octokit/rest";

export function createGithubClient(accessToken: string) {
  const octokit = new Octokit({ auth: accessToken });

  return {
    octokit,

    async getRepo(owner: string, name: string) {
      const { data } = await octokit.repos.get({ owner, repo: name });
      return data;
    },

    async listPullRequests(owner: string, name: string) {
      const per_page = 50;
      let page = 1;
      const all: any[] = [];

      while (true) {
        const { data } = await octokit.pulls.list({
          owner,
          repo: name,
          state: "all",
          per_page,
          page,
        });

        if (data.length === 0) break;
        all.push(...data);
        if (data.length < per_page) break;
        page += 1;
      }

      return all;
    },

    async getPullRequest(owner: string, name: string, number: number) {
      const { data } = await octokit.pulls.get({
        owner,
        repo: name,
        pull_number: number,
      });
      return data;
    },
  };
}

