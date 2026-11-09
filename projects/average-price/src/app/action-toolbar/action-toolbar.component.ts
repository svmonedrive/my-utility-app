import { Component, inject } from '@angular/core';
import { GithubSettingsComponent } from '@my-utility/shared';
import { OrdersService } from '../orders.service';

/**
 * The bar above the table: the year to show, the owner's "Create next year" button, what state the
 * orders are in (view only, unsaved changes, saved…), the Save button, and the key button for the
 * GitHub token.
 */
@Component({
  selector: 'app-action-toolbar',
  imports: [GithubSettingsComponent],
  styleUrl: './action-toolbar.component.scss',
  templateUrl: './action-toolbar.component.html',
})
export class ActionToolbarComponent {
  protected readonly orders = inject(OrdersService);

  /**
   * Another year was picked. If there are unsaved changes and the user keeps them, the dropdown goes
   * back to the year that is still on screen.
   */
  protected onYearChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (!this.orders.selectYear(Number(select.value))) {
      select.value = String(this.orders.selectedYear());
    }
  }
}
