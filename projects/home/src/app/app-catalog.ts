import { isDevMode } from '@angular/core';

export interface UtilityApp {
  name: string;
  description: string;
  path: string;
  devPort: number;
}

export const UTILITY_APPS: UtilityApp[] = [
  {
    name: 'Average Price',
    description: 'Calculate the average price of items.',
    path: 'average-price',
    devPort: 4201,
  },
  {
    name: 'Dummy App',
    description: 'Placeholder utility app.',
    path: 'dummy-app',
    devPort: 4202,
  },
];

/** Dev: each app runs on its own port. Production: each app is served under /<path>/. */
export function appUrl(app: UtilityApp): string {
  return isDevMode() ? `http://localhost:${app.devPort}/` : `/${app.path}/`;
}
