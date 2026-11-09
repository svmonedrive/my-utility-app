import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal, ComponentType } from '@angular/cdk/portal';
import { inject, Injectable } from '@angular/core';

/** Space between the element and the popover, in px. */
const GAP = 8;
/** The popover never gets closer than this to the edge of the screen, in px. */
const SCREEN_MARGIN = 8;

/** The popover that is open right now. */
interface OpenPopover {
  anchor: HTMLElement;
  /** Closes it. Safe to call more than once. */
  close: () => void;
}

/**
 * Shows a small popover (a tooltip-like panel) next to an element, built on the CDK overlay.
 *
 * - It sits above the element, and flips below it when there is no room above.
 * - It is pushed sideways to stay fully on screen.
 * - It closes by itself when the page scrolls, so it never floats away from its element.
 * - It ignores the mouse, so moving the pointer onto it does not make it flicker.
 * - Only one popover is open at a time.
 *
 * The page needs the CDK overlay styles once, e.g. in `angular.json`:
 *   "styles": ["node_modules/@angular/cdk/overlay-prebuilt.css", …]
 */
@Injectable({ providedIn: 'root' })
export class PopoverService {
  private readonly overlay = inject(Overlay);
  private open: OpenPopover | null = null;

  /**
   * Shows `component` next to `anchor`. Its inputs are set from `inputs` (name → value). Does nothing
   * if the popover for this same element is already open.
   */
  show<T>(
    anchor: HTMLElement,
    component: ComponentType<T>,
    inputs: Record<string, unknown> = {},
  ): void {
    if (this.open?.anchor === anchor) {
      return;
    }
    this.hide();

    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(anchor)
      .withPositions([
        {
          originX: 'center',
          originY: 'top',
          overlayX: 'center',
          overlayY: 'bottom',
          offsetY: -GAP,
        },
        { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: GAP },
      ])
      .withFlexibleDimensions(false)
      .withPush(true)
      .withViewportMargin(SCREEN_MARGIN);

    const ref = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.close(),
    });
    const componentRef = ref.attach(new ComponentPortal(component));
    for (const [name, value] of Object.entries(inputs)) {
      componentRef.setInput(name, value);
    }
    ref.overlayElement.style.pointerEvents = 'none';

    let closed = false;
    const popover: OpenPopover = {
      anchor,
      close: () => {
        if (closed) {
          return;
        }
        closed = true;
        if (this.open === popover) {
          this.open = null;
        }
        ref.dispose();
      },
    };
    // The overlay can also close itself (on scroll): clean up, so the next `show` starts fresh.
    ref.detachments().subscribe(() => popover.close());
    this.open = popover;
  }

  /** Closes the popover, if one is open. */
  hide(): void {
    this.open?.close();
  }
}
