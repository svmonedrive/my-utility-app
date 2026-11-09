import { Component, computed, inject, signal } from '@angular/core';
import { ChartMarker, LineChartComponent, LineSeries } from '@my-utility/shared';
import { formatDate } from '../date-format';
import { compareMarketWithBank, CountedOrder } from '../market-vs-bank';
import { formatCompactRupees, formatRupees, formatSignedRupees } from '../money';
import { OrdersFilterService } from '../orders-filter/orders-filter.service';
import { BANK_RATE_PERCENT } from '../returns';

const DAY_MS = 86_400_000;
const BANK_COLOR = '#2e90fa';
const MARKET_COLOR = '#12b76a';
/** The dashed lines: yellow for a buy day, green for a sell day. */
const BUY_COLOR = '#eab308';
const SELL_COLOR = '#12b76a';

/**
 * A day number (whole days since 1-Jan-1970) as "20-Oct-2026", the same format as everywhere else in
 * the app. The date is read in UTC, to match how `dayNumber` counted it.
 */
const formatDay = (day: number): string => {
  const utc = new Date(day * DAY_MS);
  return formatDate(new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate()));
};

/**
 * The panel above the table: what the orders made in the market against what the same money would have
 * earned in a bank, as four numbers and a chart with one line for each. It counts exactly the orders the
 * table lists (the filters apply), sold or not. All the arithmetic is in `compareMarketWithBank`.
 */
@Component({
  selector: 'app-returns-chart',
  imports: [LineChartComponent],
  styleUrl: './returns-chart.component.scss',
  templateUrl: './returns-chart.component.html',
})
export class ReturnsChartComponent {
  private readonly filter = inject(OrdersFilterService);

  protected readonly open = signal(true);

  /**
   * True once the panel is fully open. Only then may its content overflow the panel (a tall hover box
   * can reach past the chart); while it opens or closes the content is clipped to the moving edge.
   */
  protected readonly settled = signal(true);
  protected readonly rate = BANK_RATE_PERCENT;

  /**
   * The current price used for the orders not sold yet: the one typed for the chosen symbol. It counts
   * only while its input is shown (one symbol and the Holding filter), so a hidden price never changes
   * the numbers. It is set when the price input loses focus.
   */
  private readonly currentPrice = computed(() =>
    this.filter.showCurrentPrice() ? this.filter.currentPrice() : null,
  );

  /** Recomputed when the orders, the filters or the current price change. */
  protected readonly comparison = computed(() =>
    compareMarketWithBank(this.filter.visibleRows(), new Date(), this.currentPrice()),
  );

  /**
   * The two lines: bank interest so far, and market profit so far (it jumps on the days orders are sold,
   * and, once a current price is given, on the last day for the orders not sold yet).
   */
  protected readonly series = computed<LineSeries[]>(() => {
    const comparison = this.comparison();
    const points = comparison?.points ?? [];
    return [
      {
        name: `Bank interest (${this.rate}% a year)`,
        color: BANK_COLOR,
        points: points.map((p) => ({ x: p.day, y: p.bank })),
      },
      {
        name:
          comparison?.currentPrice != null
            ? `Market profit (not sold valued at ${formatRupees(comparison.currentPrice, 2)})`
            : 'Market profit',
        color: MARKET_COLOR,
        step: true,
        points: points.map((p) => ({ x: p.day, y: p.market })),
      },
    ];
  });

  /**
   * The dashed lines: a yellow one on every day something was bought (hovering lists what was bought,
   * and when it was sold) and a green one on every day something was sold (what was sold, and its profit).
   */
  protected readonly markers = computed<ChartMarker[]>(() => {
    const comparison = this.comparison();
    const bought = (comparison?.purchases ?? []).map((purchase) => ({
      x: purchase.day,
      title: `${formatDay(purchase.day)} · bought`,
      color: BUY_COLOR,
      legend: 'Buy day (hover for details)',
      rows: purchase.orders.flatMap((order) => this.orderRows(order)),
    }));
    const sold = (comparison?.sales ?? []).map((saleDay) => ({
      x: saleDay.day,
      title: `${formatDay(saleDay.day)} · sold`,
      color: SELL_COLOR,
      legend: 'Sell day (hover for details)',
      rows: saleDay.orders.flatMap((order) => this.saleRows(order)),
    }));
    return [...bought, ...sold];
  });

  private saleRows(order: CountedOrder): { label: string; value: string }[] {
    const sale = order.sale;
    if (!sale) {
      return [];
    }
    return [
      {
        label: order.symbol,
        value: `${order.quantity} × ${formatRupees(sale.price, 2)} = ${formatRupees(sale.price * order.quantity, 2)}`,
      },
      {
        label: `bought ${formatDay(order.buyDay)} at ${formatRupees(order.price, 2)}`,
        value: formatSignedRupees(sale.profit),
      },
    ];
  }

  private orderRows(order: CountedOrder): { label: string; value: string }[] {
    const rows = [
      {
        label: order.symbol,
        value: `${order.quantity} × ${formatRupees(order.price, 2)} = ${formatRupees(order.cost, 2)}`,
      },
    ];
    if (order.sale) {
      rows.push({
        label: `sold ${formatDay(order.sale.day)}`,
        value: `${formatSignedRupees(order.sale.profit)} at ${formatRupees(order.sale.price, 2)}`,
      });
    }
    return rows;
  }

  protected readonly formatDay = formatDay;
  protected readonly axis = formatCompactRupees;
  protected readonly money = (value: number): string => formatRupees(value, 2);
  protected readonly signedMoney = formatSignedRupees;

  protected toggle(): void {
    const open = !this.open();
    this.open.set(open);
    // With "reduce motion" there is no transition, so there is nothing to wait for.
    this.settled.set(open && matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /** The panel finished opening: let the content overflow again. */
  protected onTransitionEnd(event: TransitionEvent): void {
    if (event.target === event.currentTarget && event.propertyName === 'grid-template-rows') {
      this.settled.set(this.open());
    }
  }
}
