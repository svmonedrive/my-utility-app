import { Directive, inject, input, TemplateRef } from '@angular/core';
import { DataTableColumn } from './data-table.types';

/*
 * The four content slots of `lib-data-table`. Each is an `<ng-template>` placed inside the table tag:
 *
 *   <lib-data-table [columns]="columns" [rows]="rows">
 *     <ng-template libTh="price" let-column>…header of the "price" column…</ng-template>
 *     <ng-template libTd="price" let-row let-value="value">…cell of the "price" column…</ng-template>
 *     <ng-template libThAction>…header of the extra actions column…</ng-template>
 *     <ng-template libTdAction let-row>…buttons of that row…</ng-template>
 *   </lib-data-table>
 *
 * `libTh` and `libTd` can name one column (as above) or have no name, to apply to every column that has
 * no template of its own.
 */

/** What a `libTh` template receives: `let-column` is the column. */
export interface LibThContext<T = any> {
  $implicit: DataTableColumn<T>;
}

/** What a `libTd` template receives: `let-row`, `let-column="column"`, `let-value="value"`. */
export interface LibTdContext<T = any> {
  $implicit: T;
  column: DataTableColumn<T>;
  value: unknown;
}

/** What a `libTdAction` template receives: `let-row`. */
export interface LibTdActionContext<T = any> {
  $implicit: T;
}

/** Header cell template: for the column named in `libTh="key"`, or for all other columns when unnamed. */
@Directive({ selector: 'ng-template[libTh]' })
export class LibThDirective {
  readonly key = input('', { alias: 'libTh' });
  readonly template = inject<TemplateRef<LibThContext>>(TemplateRef);
}

/** Body cell template: for the column named in `libTd="key"`, or for all other columns when unnamed. */
@Directive({ selector: 'ng-template[libTd]' })
export class LibTdDirective {
  readonly key = input('', { alias: 'libTd' });
  readonly template = inject<TemplateRef<LibTdContext>>(TemplateRef);
}

/** Header cell of the extra actions column. Adds the column when present. */
@Directive({ selector: 'ng-template[libThAction]' })
export class LibThActionDirective {
  readonly template = inject<TemplateRef<void>>(TemplateRef);
}

/** Body cell of the extra actions column, once per row. Adds the column when present. */
@Directive({ selector: 'ng-template[libTdAction]' })
export class LibTdActionDirective {
  readonly template = inject<TemplateRef<LibTdActionContext>>(TemplateRef);
}
