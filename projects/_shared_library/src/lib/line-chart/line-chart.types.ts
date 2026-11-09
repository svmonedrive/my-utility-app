/** One point of a line: `x` and `y` are plain numbers (the chart's labels turn them into dates, money…). */
export interface LinePoint {
  x: number;
  y: number;
}

/** One line of the chart. */
export interface LineSeries {
  /** Shown in the legend and the hover box. */
  name: string;
  /** Colour of the line, e.g. `'#2e90fa'`. */
  color: string;
  /** The points, oldest `x` first. */
  points: readonly LinePoint[];
  /** Shade the area under the line. */
  fill?: boolean;
  /** Draw a staircase: the value holds until the next point, then jumps. For things that change in jumps. */
  step?: boolean;
  /**
   * Do not draw this series and leave it out of the legend, but keep its value in the hover box. For a
   * number that belongs next to the lines without needing a line of its own.
   */
  hidden?: boolean;
}

/**
 * A vertical dashed line at one position (e.g. a day something happened), with its own hover box that
 * lists what happened. Hovering close to the line shows this box instead of the usual one.
 */
export interface ChartMarker {
  /** Where the line is, on the horizontal axis. */
  x: number;
  /** Heading of the hover box, e.g. the date. */
  title: string;
  /** The lines of the hover box: a label on the left and a value on the right. */
  rows: readonly { label: string; value: string }[];
  /** Colour of the line, e.g. `'#eab308'`. Without one it is grey. */
  color?: string;
  /**
   * Its name in the legend, e.g. `'Purchase day'`. Markers with the same legend name share one legend
   * entry. Without one, the chart's `markersName` is used.
   */
  legend?: string;
}
