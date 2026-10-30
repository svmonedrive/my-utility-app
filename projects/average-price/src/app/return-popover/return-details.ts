import { formatRupees, formatSignedAmount } from '../money';
import { BANK_RATE_PERCENT, BankReturn, Returns } from '../returns';

/** Everything the return popover (and the bar's screen-reader label) displays, as ready-made text. */
export interface ReturnDetails {
  /** How the actual return compares with the bank; `pending` while the order is not sold yet. */
  state: 'ahead' | 'behind' | 'loss' | 'pending';
  /** The popover title, e.g. "Rs. 12,050.50 held for 34 days"; empty without a quantity. */
  title: string;
  /** First line of the body, e.g. "Actual (+150.00) vs Bank (+9.40)". */
  comparison: string;
  actualText: string;
  bankText: string;
  summary: string;
  label: string;
}

const signedPercent = (n: number): string => `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;

// e.g. "+4.00% (+440.00)"; just the percentage without a quantity.
const withAmount = (percent: number, amount: number | null): string =>
  amount === null
    ? signedPercent(percent)
    : `${signedPercent(percent)} (${formatSignedAmount(amount)})`;

const daysLabel = (days: number): string => `${days} ${days === 1 ? 'day' : 'days'}`;

const heldTitle = (investedAmount: number | null, days: number): string =>
  investedAmount === null ? '' : `${formatRupees(investedAmount, 2)} held for ${daysLabel(days)}`;

export function describeReturns(returns: Returns): ReturnDetails {
  const {
    actualPercent: actual,
    bankPercent: bank,
    days,
    actualAmount,
    bankAmount,
    investedAmount,
  } = returns;

  // The rupee gap to the bank, signed (+ when ahead of the bank), e.g. " (+150.00)"; empty without a quantity.
  const gapSuffix =
    actualAmount === null || bankAmount === null
      ? ''
      : ` (${formatSignedAmount(actualAmount - bankAmount)})`;

  return {
    state: actual < 0 ? 'loss' : actual >= bank ? 'ahead' : 'behind',
    title: heldTitle(investedAmount, days),
    comparison:
      actualAmount === null || bankAmount === null
        ? 'Actual vs Bank return'
        : `Actual (${formatSignedAmount(actualAmount)}) vs Bank (${formatSignedAmount(bankAmount)})`,
    actualText: withAmount(actual, actualAmount),
    bankText: withAmount(bank, bankAmount),
    summary:
      actual < 0
        ? `Lost money. The bank would have given ${withAmount(bank, bankAmount)}`
        : `${actual >= bank ? 'Beat' : 'Behind'} the bank by ${Math.abs(actual - bank).toFixed(2)}%${gapSuffix}`,
    label: `Actual ${withAmount(actual, actualAmount)} vs bank ${withAmount(bank, bankAmount)} (${BANK_RATE_PERCENT}% a year) over ${daysLabel(days)}`,
  };
}

/** For an order that is not sold yet: only the bank side is known, counted from the buy date until today. */
export function describePending(pending: BankReturn): ReturnDetails {
  const { bankPercent: bank, days, bankAmount, investedAmount } = pending;
  const bankText = withAmount(bank, bankAmount);

  return {
    state: 'pending',
    title: heldTitle(investedAmount, days),
    comparison:
      bankAmount === null
        ? 'Actual vs Bank return'
        : `Actual (not sold yet) vs Bank (${formatSignedAmount(bankAmount)})`,
    actualText: 'Not sold yet',
    bankText,
    summary: `The bank would have given ${bankText} so far`,
    label: `Not sold yet. The bank would have given ${bankText} (${BANK_RATE_PERCENT}% a year) over ${daysLabel(days)}`,
  };
}
