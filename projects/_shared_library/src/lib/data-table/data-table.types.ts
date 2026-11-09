/** Describes one column of the data table. */
export interface DataTableColumn<T = unknown> {
  /**
   * Unique name of the column. By default the cell shows this property of the row. It is also the
   * name that `libTh="key"` and `libTd="key"` templates use to target this column.
   */
  key: string;
  /** Text of the header cell (unless a `libTh` template replaces it). */
  header: string;
  /** What the cell shows by default, if it is not simply `row[key]`. */
  value?: (row: T) => unknown;
  /** Minimum width of the column, e.g. `'10rem'`. Overrides `--lib-table-column-min-width`. */
  minWidth?: string;
  /** Keep the cell content on one line. */
  nowrap?: boolean;
  /** Horizontal alignment of the cell content. */
  align?: 'start' | 'center' | 'end';
}

/** What a row event carries: the row it happened on, and the original DOM event. */
export interface RowEvent<T, E extends Event = Event> {
  row: T;
  event: E;
}
