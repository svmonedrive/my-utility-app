import { Component } from '@angular/core';
import { appUrl, UTILITY_APPS } from '../app-catalog';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  protected readonly apps = UTILITY_APPS.map((app) => ({ ...app, url: appUrl(app) }));
}
