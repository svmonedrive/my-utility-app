import { Component, inject } from '@angular/core';
import { GithubSettingsComponent } from '@my-utility/shared';
import { OrdersService } from '../orders.service';

/**
 * The bar above the table: what state the orders are in (view only, unsaved changes, saved…), the
 * Save button for the owner, and the key button for the GitHub token.
 */
@Component({
  selector: 'app-action-toolbar',
  imports: [GithubSettingsComponent],
  styleUrl: './action-toolbar.component.scss',
  templateUrl: './action-toolbar.component.html',
})
export class ActionToolbarComponent {
  protected readonly orders = inject(OrdersService);
}
