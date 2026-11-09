# @my-utility/shared

Shared, reusable components for the utility apps in this repo. Apps import them as
`@my-utility/shared`, which `tsconfig.json` maps straight to this library's source, so there is no
build step while developing.

## `lib-data-table`

A plain table built on the CDK table. It shows the `columns` and `rows` it is given and nothing
else: it does not load, filter, sort or edit anything.

```html
<lib-data-table [columns]="columns" [rows]="rows" [trackBy]="byId" [rowStyle]="rowStyle">
  <!-- header of one column (name it), or of every column without its own template (no name) -->
  <ng-template libTh="price" let-column>{{ column.header }} (Rs.)</ng-template>

  <!-- body cell of one column; `let-row`, `let-value="value"`, `let-column="column"` -->
  <ng-template libTd="price" let-row let-value="value">Rs. {{ value }}</ng-template>

  <!-- an extra last column, for buttons -->
  <ng-template libThAction><button>Add</button></ng-template>
  <ng-template libTdAction let-row><button (click)="edit(row)">Edit</button></ng-template>
</lib-data-table>
```

```ts
columns: DataTableColumn<Order>[] = [
  { key: 'symbol', header: 'Symbol' },
  { key: 'price', header: 'Price', minWidth: '12rem', nowrap: true },
];
```

- Without a template, a cell shows `row[key]` (or `column.value(row)`) as text.
- Events on a row come out as `rowClick`, `rowDblClick`, `rowMouseDown`, `rowPointerUp` and
  `rowKeyDown`, each with `{ row, event }`.
- The header row is sticky. The table fills the height it is given, so make the `lib-data-table`
  element `flex: 1` in a flex column, or give it a height.
- Look: set `--lib-table-border-color`, `--lib-table-header-background`,
  `--lib-table-cell-padding-block`, `--lib-table-cell-padding-inline` and `--lib-table-column-min-width`
  on the element.

## Building the package

`ng build _shared_library` writes the publishable package to `dist/_shared_library`. The apps do not need it.
