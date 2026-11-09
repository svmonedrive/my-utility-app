import { CdkScrollable } from '@angular/cdk/scrolling';
import { CdkTableModule } from '@angular/cdk/table';
import { NgStyle, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  contentChild,
  contentChildren,
  input,
  output,
  TemplateRef,
  TrackByFunction,
} from '@angular/core';
import {
  LibTdActionDirective,
  LibTdContext,
  LibTdDirective,
  LibThActionDirective,
  LibThContext,
  LibThDirective,
} from './data-table.directives';
import { DataTableColumn, RowEvent } from './data-table.types';

/** Key of the extra column that holds the `libThAction` / `libTdAction` templates. */
const ACTIONS_KEY = '__actions';

/**
 * A plain table: it shows the `columns` and `rows` it is given, and nothing else. It knows nothing
 * about what the rows are, and it never changes them. Built on the CDK table.
 *
 * - Every column shows `row[column.key]` (or `column.value(row)`) as text by default.
 * - Header and body cells can be replaced with `libTh` / `libTd` templates, for one column or for all
 *   columns; `libThAction` / `libTdAction` add an extra last column, for buttons and the like.
 * - The header row stays in view while the body scrolls. The table fills the height it is given
 *   (give the `lib-data-table` element a height, or `flex: 1` inside a flex column).
 * - What happens on a row is reported through the `row…` outputs; the table does not act on it.
 * - Look: set the CSS variables `--lib-table-border-color`, `--lib-table-header-background`,
 *   `--lib-table-cell-padding-block`, `--lib-table-cell-padding-inline` and
 *   `--lib-table-column-min-width` on the element.
 */
@Component({
  selector: 'lib-data-table',
  imports: [CdkScrollable, CdkTableModule, NgStyle, NgTemplateOutlet],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss',
})
export class DataTableComponent<T> {
  /** The columns to show, in order. */
  readonly columns = input.required<readonly DataTableColumn<T>[]>();

  /** The rows to show, in order. */
  readonly rows = input.required<readonly T[]>();

  /** Tells rows apart, so existing rows keep their cells (and any typing in them) when the list changes. */
  readonly trackBy = input<TrackByFunction<T>>((index) => index);

  /** Inline styles for a row, e.g. a background colour that depends on the row's data. */
  readonly rowStyle = input<(row: T) => Record<string, string> | null | undefined>();

  readonly rowClick = output<RowEvent<T, MouseEvent>>();
  readonly rowDblClick = output<RowEvent<T, MouseEvent>>();
  readonly rowMouseDown = output<RowEvent<T, MouseEvent>>();
  readonly rowPointerUp = output<RowEvent<T, PointerEvent>>();
  readonly rowKeyDown = output<RowEvent<T, KeyboardEvent>>();

  private readonly headerTemplates = contentChildren(LibThDirective, { descendants: true });
  private readonly cellTemplates = contentChildren(LibTdDirective, { descendants: true });
  protected readonly actionHeader = contentChild(LibThActionDirective);
  protected readonly actionCell = contentChild(LibTdActionDirective);

  protected readonly actionsKey = ACTIONS_KEY;
  protected readonly hasActions = computed(() => !!this.actionHeader() || !!this.actionCell());

  /** The columns in display order, plus the actions column when there is one. */
  protected readonly columnKeys = computed(() => [
    ...this.columns().map((column) => column.key),
    ...(this.hasActions() ? [ACTIONS_KEY] : []),
  ]);

  /** The `libTh` template for a column: the one named after it, else the unnamed one, else none. */
  protected headerTemplate(column: DataTableColumn<T>): TemplateRef<LibThContext> | null {
    const templates = this.headerTemplates();
    const own = templates.find((t) => t.key() === column.key) ?? templates.find((t) => !t.key());
    return own?.template ?? null;
  }

  /** The `libTd` template for a column: the one named after it, else the unnamed one, else none. */
  protected cellTemplate(column: DataTableColumn<T>): TemplateRef<LibTdContext> | null {
    const templates = this.cellTemplates();
    const own = templates.find((t) => t.key() === column.key) ?? templates.find((t) => !t.key());
    return own?.template ?? null;
  }

  protected valueOf(row: T, column: DataTableColumn<T>): unknown {
    return column.value ? column.value(row) : (row as Record<string, unknown>)[column.key];
  }

  /** Per-column look: width, no wrapping, alignment. */
  protected columnStyle(column: DataTableColumn<T>): Record<string, string | null> {
    return {
      'min-width': column.minWidth ?? null,
      'white-space': column.nowrap ? 'nowrap' : null,
      'text-align': column.align ?? null,
    };
  }
}
