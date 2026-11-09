// The "meta" file of the orders table: its constants, types and static lists. The functions it uses
// are in `orders-table.helper.ts`, and `orders-table.component.ts` only wires everything together.

import { DataTableColumn } from '@my-utility/shared';
import { ReturnDetails } from '../return-popover/return-details';
import { TradeRow, TradeSymbol } from '../trade-row';

/** The Symbol filter's "no filtering" choice. */
export const ALL_SYMBOLS = 'All';
export type SymbolFilter = typeof ALL_SYMBOLS | TradeSymbol;

/** Two taps on the same row within this many milliseconds count as a double tap. */
export const DOUBLE_TAP_MS = 350;

/** The columns of the table. Their cells are drawn by the `libTd` templates in the component's template. */
export const ORDERS_COLUMNS: DataTableColumn<TradeRow>[] = [
  { key: 'symbol', header: 'Symbol', minWidth: '10.5rem' },
  { key: 'buyDate', header: 'Buy date' },
  { key: 'buyPrice', header: 'Price', minWidth: '12rem', nowrap: true },
  { key: 'quantity', header: 'Quantity' },
  { key: 'sellDate', header: 'Sell date', minWidth: '10rem', nowrap: true },
  { key: 'sellPrice', header: 'Price', minWidth: '12rem', nowrap: true },
  { key: 'statistics', header: 'Statistics' },
];

/** What the Statistics cell of a row draws: two bars, and the details its popover shows. */
export interface ReturnBar {
  /**
   * Bar widths in percent of the cell. For a sold order the larger of the two returns fills the
   * cell and the other is its ratio. For an order not sold yet both are full width.
   */
  actualWidth: number;
  bankWidth: number;
  details: ReturnDetails;
}
