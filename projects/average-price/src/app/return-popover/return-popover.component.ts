import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { BANK_RATE_PERCENT } from '../returns';
import { ReturnDetails } from './return-details';

const SCREEN_MARGIN = 8;

/**
 * Popover with the return details of one row. It is as wide as its content, points at `anchorX`
 * (the centre of a cell), and nudges itself sideways to stay fully on screen.
 */
@Component({
  selector: 'app-return-popover',
  templateUrl: './return-popover.component.html',
  styleUrl: './return-popover.component.scss',
})
export class ReturnPopoverComponent {
  readonly details = input.required<ReturnDetails>();
  /** Viewport x (px) of the point the popover is centred on. */
  readonly anchorX = input.required<number>();
  /** Viewport y (px) of the edge the popover touches: its bottom edge, or its top edge when `below`. */
  readonly top = input.required<number>();
  /** Show under the anchor instead of above it. */
  readonly below = input(false);

  protected readonly bankRate = BANK_RATE_PERCENT;

  private readonly element = viewChild.required<ElementRef<HTMLElement>>('popover');
  private readonly shift = signal(0);

  /** Where the popover is centred: the anchor, nudged to keep the whole popover on screen. */
  protected readonly left = computed(() => this.anchorX() + this.shift());

  constructor() {
    // The width depends on the text, so measure after rendering. Re-measure if anchor or content change.
    afterRenderEffect(() => {
      const anchorX = this.anchorX();
      this.details();
      const half = this.element().nativeElement.getBoundingClientRect().width / 2;
      const centre = Math.max(
        half + SCREEN_MARGIN,
        Math.min(anchorX, window.innerWidth - half - SCREEN_MARGIN),
      );
      untracked(() => this.shift.set(centre - anchorX));
    });
  }
}
