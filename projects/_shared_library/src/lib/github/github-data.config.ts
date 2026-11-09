import { InjectionToken, Provider } from '@angular/core';

/** Which file in which GitHub repo an app keeps its data in. */
export interface GithubDataConfig {
  /** Owner of the data repo, e.g. `'svmonedrive'`. */
  owner: string;
  /** Name of the data repo, e.g. `'my-utility-app-data'`. */
  repo: string;
  /** Branch the file lives on, e.g. `'main'`. */
  branch: string;
  /** Path of the JSON file inside the repo, e.g. `'average-price-app-data/orders.json'`. */
  path: string;
  /** Commit message for a save. Default: "Update data from my-utility-app". */
  commitMessage?: string;
}

/** Where the GitHub data pieces (`GithubDataStore`, `lib-github-settings`) get their settings. */
export const GITHUB_DATA_CONFIG = new InjectionToken<GithubDataConfig>('GITHUB_DATA_CONFIG');

/**
 * Tells the GitHub data pieces which file to use. Add it to the app's providers:
 *
 *   providers: [provideGithubData({ owner, repo, branch, path })]
 */
export function provideGithubData(config: GithubDataConfig): Provider {
  return { provide: GITHUB_DATA_CONFIG, useValue: config };
}
