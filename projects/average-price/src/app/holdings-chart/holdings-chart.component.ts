import { Component, computed, inject, signal } from '@angular/core';
import { ChartMarker, LineChartComponent, LineSeries } from '@my-utility/shared';
import { formatDate } from '../date-format';
import { compareHoldingsWithBank } from '../holdings-bank';
import { formatCompactRupees, formatRupees } from '../money';
import { OrdersService } from '../orders.service';
import { BANK_RATE_PERCENT } from '../returns';

const DAY_MS = 86_400_000;
const INVESTED_COLOR = '#475467';
const BANK_COLOR = '#2e90fa';

/**
 * A day number (whole days since 1-Jan-1970) as "20-Oct-2026", the same format as everywhere else in
 * the app. The date is read in UTC, to match how `dayNumber` counted it.
 */
const formatDay = (day: number): string => {
  const utc = new Date(day * DAY_MS);
  return formatDate(new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate()));
};

/**
 * The panel above the table: the holdings (orders not sold yet) against the same money kept in a bank,
 * as four numbers and a chart. All the arithmetic is in `compareHoldingsWithBank`.
 */
@Component({
  selector: 'app-holdings-chart',
  imports: [LineChartComponent],
  styleUrl: './holdings-chart.component.scss',
  templateUrl: './holdings-chart.component.html',
})
export class HoldingsChartComponent {
  private readonly orders = inject(OrdersService);

  protected readonly open = signal(true);
  protected readonly rate = BANK_RATE_PERCENT;

  /** Recomputed when the list of orders changes, e.g. when a row is marked Done. */
  protected readonly comparison = computed(() =>
    compareHoldingsWithBank(this.orders.rows(), new Date()),
  );

  /** The chart: how much went in, and what the same money would be worth in the bank. */
  protected readonly valueSeries = computed<LineSeries[]>(() => {
    const points = this.comparison()?.points ?? [];
    return [
      {
        name: 'Invested',
        color: INVESTED_COLOR,
        // Money going in is an event, shown by the dashed purchase lines. The total still appears in
        // the hover box, so it is kept as a series that is not drawn.
        hidden: true,
        points: points.map((p) => ({ x: p.day, y: p.invested })),
      },
      {
        name: `Same money in bank (${this.rate}% a year)`,
        color: BANK_COLOR,
        points: points.map((p) => ({ x: p.day, y: p.bank })),
      },
    ];
  });

  /** A dashed line on every day something was bought; hovering it lists what was bought. */
  protected readonly purchaseMarkers = computed<ChartMarker[]>(() =>
    (this.comparison()?.purchases ?? []).map((purchase) => ({
      x: purchase.day,
      title: `${formatDay(purchase.day)} · bought`,
      rows: [
        ...purchase.orders.map((order) => ({
          label: order.symbol,
          value: `${order.quantity} × ${formatRupees(order.price, 2)} = ${formatRupees(order.cost, 2)}`,
        })),
        { label: 'Invested after this', value: formatRupees(purchase.investedAfter, 2) },
      ],
    })),
  );

  protected readonly formatDay = formatDay;
  protected readonly axis = formatCompactRupees;
  protected readonly money = (value: number): string => formatRupees(value, 2);

  protected toggle(): void {
    this.open.update((open) => !open);
  }
}
