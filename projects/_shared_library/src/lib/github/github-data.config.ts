import { InjectionToken, Provider } from '@angular/core';

/** Which folder in which GitHub repo an app keeps its data files in. */
export interface GithubDataConfig {
  /** Owner of the data repo, e.g. `'svmonedrive'`. */
  owner: string;
  /** Name of the data repo, e.g. `'my-utility-app-data'`. */
  repo: string;
  /** Branch the files live on, e.g. `'main'`. */
  branch: string;
  /** Folder of the app's files inside the repo, e.g. `'average-price-app-data'`. */
  folder: string;
  /** Start of the commit message for a save; the file name is added. Default: "Update data from my-utility-app". */
  commitMessage?: string;
}

/** Where the GitHub data pieces (the read and commit services, `lib-github-settings`) get their settings. */
export const GITHUB_DATA_CONFIG = new InjectionToken<GithubDataConfig>('GITHUB_DATA_CONFIG');

/**
 * Tells the GitHub data pieces which folder to use. Add it to the app's providers:
 *
 *   providers: [provideGithubData({ owner, repo, branch, folder })]
 */
export function provideGithubData(config: GithubDataConfig): Provider {
  return { provide: GITHUB_DATA_CONFIG, useValue: config };
}
