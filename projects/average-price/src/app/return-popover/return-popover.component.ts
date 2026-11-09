import { Component, input } from '@angular/core';
import { BANK_RATE_PERCENT } from '../returns';
import { ReturnDetails } from './return-details';

/**
 * The content of the popover with the return details of one row. It only draws the panel: where it
 * appears (next to the cell, flipping and staying on screen) is `PopoverService`'s job.
 */
@Component({
  selector: 'app-return-popover',
  templateUrl: './return-popover.component.html',
  styleUrl: './return-popover.component.scss',
})
export class ReturnPopoverComponent {
  readonly details = input.required<ReturnDetails>();

  protected readonly bankRate = BANK_RATE_PERCENT;
}
