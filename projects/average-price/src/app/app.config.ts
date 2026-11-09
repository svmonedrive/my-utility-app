import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideGithubData } from '@my-utility/shared';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    // The data lives in its own public repo: anyone can read it, only the owner's token can change it.
    // The repo keeps one folder per app, named `<app-name>-app-data`; another app (say `xyz`) would
    // use `xyz-app-data/<its file>` in the same way.
    provideGithubData({
      owner: 'svmonedrive',
      repo: 'my-utility-app-data',
      branch: 'main',
      folder: 'average-price-app-data',
      commitMessage: 'Update orders from my-utility-app',
    }),
  ],
};
