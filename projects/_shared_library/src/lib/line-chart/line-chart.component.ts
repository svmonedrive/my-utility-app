import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ChartMarker, LinePoint, LineSeries } from './line-chart.types';

const MARGIN = { top: 10, right: 14, bottom: 26, left: 58 };
/** Wanted number of horizontal grid lines (the real number depends on the "nice" step). */
const WANTED_Y_TICKS = 4;
/** How close to a marker line (in px) the pointer must be to show that marker's box. */
const MARKER_HIT = 5;

/** A step size of 1, 2, 2.5, 5 or 10 times a power of ten, close to `rough`. */
function niceStep(rough: number): number {
  const power = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / power;
  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

/** Index of the point whose `x` is closest to `x`. `points` are sorted by `x`. */
function nearestIndex(points: readonly LinePoint[], x: number): number {
  let low = 0;
  let high = points.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (points[mid].x < x) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low > 0 && x - points[low - 1].x <= points[low].x - x ? low - 1 : low;
}

/**
 * A simple line chart drawn as SVG: one or more lines (optionally stepped or shaded), a value axis that
 * always includes zero (and goes below it for negative values), and a hover (or touch) box that shows the values at the nearest point. Optional vertical
 * dashed marker lines show events, each with a hover box of its own. It fills the width it is given
 * and re-draws when that changes.
 */
@Component({
  selector: 'lib-line-chart',
  templateUrl: './line-chart.component.html',
  styleUrl: './line-chart.component.scss',
})
export class LineChartComponent {
  readonly series = input.required<readonly LineSeries[]>();
  /** Vertical dashed lines for events, e.g. the days something was bought. */
  readonly markers = input<readonly ChartMarker[]>([]);
  /** Legend text for the marker lines that have no `legend` of their own. Left empty, they are not in the legend. */
  readonly markersName = input('');
  /** Height of the chart in px. */
  readonly height = input(220);
  /** Text for a position on the horizontal axis, e.g. a date. */
  readonly xLabel = input<(x: number) => string>((x) => String(x));
  /** Short text for a tick on the vertical axis, e.g. `'1.5L'`. */
  readonly yLabel = input<(y: number) => string>((y) => String(y));
  /** Full text for a value in the hover box, e.g. `'Rs. 1,50,000.00'`. */
  readonly valueLabel = input<(y: number) => string>((y) => String(y));
  /** What a screen reader says about the chart. */
  readonly ariaLabel = input('Line chart');

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly width = signal(600);

  /** The hovered position, as a value on the horizontal axis (snapped to a point). */
  protected readonly hoverX = signal<number | null>(null);

  /**
   * The marker lines the pointer is on. Usually one; more when several markers are at the same
   * position (e.g. something was bought and something sold on the same day): their boxes are shown together.
   */
  protected readonly hoverMarkers = signal<readonly ChartMarker[]>([]);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const observer = new ResizeObserver((entries) =>
        this.width.set(Math.max(240, Math.floor(entries[0].contentRect.width))),
      );
      observer.observe(this.element.nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  /** Everything needed to draw: scales, ticks, the path of every line and the marker lines. */
  protected readonly chart = computed(() => {
    const all = this.series().flatMap((s) => s.points);
    if (!all.length) {
      return null;
    }
    const width = this.width();
    const height = this.height();
    const plotWidth = width - MARGIN.left - MARGIN.right;
    const plotHeight = height - MARGIN.top - MARGIN.bottom;

    let xMin = Math.min(...all.map((p) => p.x));
    let xMax = Math.max(...all.map((p) => p.x));
    if (xMin === xMax) {
      xMin -= 1;
      xMax += 1;
    }
    // The value axis always includes 0. It reaches below 0 only when a line does (a loss).
    const yMaxData = Math.max(...all.map((p) => p.y), 0);
    const yMinData = Math.min(...all.map((p) => p.y), 0);
    const step = niceStep((yMaxData - yMinData || 1) / WANTED_Y_TICKS);
    const yBottom = Math.floor(yMinData / step) * step;
    let yTop = Math.ceil(yMaxData / step) * step;
    if (yTop === yBottom) {
      yTop = yBottom + step;
    }

    const x = (value: number) => MARGIN.left + ((value - xMin) / (xMax - xMin)) * plotWidth;
    const y = (value: number) =>
      MARGIN.top + plotHeight - ((value - yBottom) / (yTop - yBottom)) * plotHeight;

    const yTicks = [];
    const tickCount = Math.round((yTop - yBottom) / step);
    for (let i = 0; i <= tickCount; i++) {
      const value = Number((yBottom + i * step).toPrecision(12));
      yTicks.push({
        value,
        y: y(value),
        label: this.yLabel()(value),
        // The zero line stands out when there is a part of the chart below it.
        zero: value === 0 && yBottom < 0,
      });
    }
    const xCount = Math.max(2, Math.min(6, Math.floor(plotWidth / 120)));
    const xTicks = Array.from({ length: xCount }, (_, i) => {
      const value = Math.round(xMin + ((xMax - xMin) * i) / (xCount - 1));
      return {
        value,
        x: x(value),
        label: this.xLabel()(value),
        anchor: i === 0 ? 'start' : i === xCount - 1 ? 'end' : 'middle',
      };
    });

    const baseline = y(0);
    const paths = this.series()
      .filter((s) => !s.hidden)
      .map((s) => {
        const points = s.points.map((p) => ({ x: x(p.x), y: y(p.y) }));
        let line = '';
        points.forEach((p, i) => {
          if (i === 0) {
            line = `M${p.x},${p.y}`;
          } else {
            line += s.step ? `H${p.x}V${p.y}` : `L${p.x},${p.y}`;
          }
        });
        const area =
          s.fill && points.length > 1
            ? `${line}L${points[points.length - 1].x},${baseline}L${points[0].x},${baseline}Z`
            : null;
        return {
          name: s.name,
          color: s.color,
          line: points.length > 1 ? line : '',
          area,
          // A single point has no line to draw: show it as a dot instead.
          dot: points.length === 1 ? points[0] : null,
        };
      });

    // Markers at the same position are drawn with their dashes interleaved, so every colour shows.
    const seen = new Map<number, number>();
    const markerLines = this.markers()
      .filter((marker) => marker.x >= xMin && marker.x <= xMax)
      .map((marker) => {
        const count = seen.get(marker.x) ?? 0;
        seen.set(marker.x, count + 1);
        return { marker, x: x(marker.x), offset: count * 4 };
      });

    const markerLegend: { name: string; color: string | null }[] = [];
    for (const { marker } of markerLines) {
      const name = marker.legend ?? this.markersName();
      if (name && !markerLegend.some((item) => item.name === name)) {
        markerLegend.push({ name, color: marker.color ?? null });
      }
    }

    return {
      width,
      height,
      plotWidth,
      xMin,
      xMax,
      x,
      y,
      yTicks,
      xTicks,
      paths,
      markerLines,
      markerLegend,
      plotLeft: MARGIN.left,
      plotRight: width - MARGIN.right,
      plotTop: MARGIN.top,
      plotBottom: MARGIN.top + plotHeight,
    };
  });

  /** What the usual hover box shows: the position and the value of every series there. */
  protected readonly hover = computed(() => {
    const chart = this.chart();
    const position = this.hoverX();
    if (!chart || position === null) {
      return null;
    }
    const entries = this.series()
      .filter((s) => s.points.length)
      .map((s) => {
        const point = s.points[nearestIndex(s.points, position)];
        return {
          name: s.name,
          color: s.color,
          value: this.valueLabel()(point.y),
          cx: chart.x(point.x),
          cy: chart.y(point.y),
          drawn: !s.hidden,
        };
      });
    const px = chart.x(position);
    return { x: px, label: this.xLabel()(position), entries, flip: px > chart.width / 2 };
  });

  /** The box of the marker line(s) the pointer is on. */
  protected readonly markerBox = computed(() => {
    const chart = this.chart();
    const markers = this.hoverMarkers();
    if (!chart || !markers.length) {
      return null;
    }
    const px = chart.x(markers[0].x);
    return { x: px, markers, flip: px > chart.width / 2 };
  });

  protected onPointerMove(event: PointerEvent): void {
    const chart = this.chart();
    if (!chart) {
      return;
    }
    const box = (event.currentTarget as SVGElement).getBoundingClientRect();
    const pointerX = event.clientX - box.left;

    // On (or right next to) a marker line: show that marker's box instead of the usual one. When
    // several markers are on the same spot, all of them are shown.
    const distances = chart.markerLines.map((line) => Math.abs(line.x - pointerX));
    const closest = Math.min(...distances);
    if (closest <= MARKER_HIT) {
      this.hoverMarkers.set(
        chart.markerLines
          .filter((_, i) => distances[i] - closest < 0.5)
          .map((line) => line.marker),
      );
      this.hoverX.set(null);
      return;
    }

    this.hoverMarkers.set([]);
    const inside = Math.min(Math.max(pointerX, chart.plotLeft), chart.plotRight);
    const wanted =
      chart.xMin + ((inside - chart.plotLeft) / chart.plotWidth) * (chart.xMax - chart.xMin);
    // Snap to the nearest point of the first series, so the box always shows real data.
    const first = this.series().find((s) => s.points.length);
    this.hoverX.set(first ? first.points[nearestIndex(first.points, wanted)].x : null);
  }

  protected onPointerLeave(): void {
    this.hoverX.set(null);
    this.hoverMarkers.set([]);
  }
}
