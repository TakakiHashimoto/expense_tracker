# Subscription payment observation recency

P05-RECENCY estimates how recently a detected monthly payment pattern was
observed. It does not establish that a subscription is active, cancelled, or
unpaid. Task status, review evidence, and remaining integration work are tracked in
[BANKOS_PROGRESS.md](BANKOS_PROGRESS.md).

## Domain contract

`evaluateSubscriptionRecency(recurringTriple, asOfDate, graceDays = 5)` is a pure
function returning `{ status, nextExpectedPaymentDate }`. It takes exactly three
already-detected transactions and an explicit `YYYY-MM-DD` evaluation date.
It never reads the current clock, performs I/O, or mutates its inputs. It validates
the calendar pattern; the existing detector remains responsible for grouping,
amount stability, expense eligibility, and choosing the recurring triple.

The three dates are sorted on a copy and must occupy three consecutive months.
When all three are month-end, the forecast uses each future month's last day.
Otherwise all three must share a calendar day. A fixed day that is absent in a
future month is clamped to that month's last day. Both forecasts retain the
original day anchor: a January 30 payment forecasts February 28 and March 30,
not March 28. Leap years and year transitions use UTC calendar arithmetic,
never fixed 30-day month approximations.

Let E1 be the first expected date after the last observed payment, E2 the second,
and G the grace period in calendar days:

| Condition | Status |
| --- | --- |
| Last observed payment is after the evaluation date, or input is invalid | `unknown` |
| Evaluation date is before E1 | `recent` |
| E1 through E1 + G, inclusive | `grace_period` |
| After E1 + G through E2 + G, inclusive | `payment_not_observed` |
| Strictly after E2 + G | `long_unobserved` |

The last observed payment may equal the evaluation date. With zero grace, E1
itself remains `grace_period`; E2 itself remains `payment_not_observed`.
`nextExpectedPaymentDate` always refers to E1, even when E1 is in the past. It is
not rolled forward to a future date and is not a confirmed bill or due date.
Unknown results return `null` for this field.

Invalid input includes malformed or impossible dates, missing/extra transactions,
nonconsecutive months, unsupported day patterns, negative/noninteger/nonfinite
grace, and unrepresentable forecast or grace dates. The supported date range is
years 0001–9999. Unsorted triples are supported. The evaluator does not broaden
the existing detector's accepted inputs or change which candidates it selects.

## Integration and display

`getDetectedSubscriptions(fromDate)` resolves one UTC evaluation date before
awaiting transaction retrieval and passes it to `detectSubscriptions`. All
candidates in that request use the same date, even across midnight.

`detectSubscriptions(transactions, asOfDate?)` evaluates each selected triple
independently and adds `candidate.recency`. Omitting the date preserves legacy
detection-only output exactly, without a hidden clock or inferred evaluation
date. Accordingly, the new `SubscriptionCandidate.recency` property is optional;
the normal server path always supplies it. Invalid evaluation dates produce
unknown recency without dropping otherwise valid detected candidates.

The dashboard displays observation labels and E1 as an estimate after the last
payment. Unevaluated legacy candidates display unknown recency without a forecast.
Rows from the same merchant use their selected transaction IDs to distinguish
their individual observations. Recency does not remove candidates, change
estimated amounts, or filter the currency-separated monthly totals.

## Limitations

- Missing observations can result from stale Plaid synchronization, delayed
  posting, missing transaction history, or merchant normalization/grouping.
  These statuses cannot distinguish those causes from a discontinued pattern.
- The evaluation uses the selected triple, not a contractual billing schedule or
  an independent check of every later transaction. A later irregular charge may
  exist outside the chosen pattern. No claim of nonpayment is made.
- Fixed-day clamping and a five-day default grace period are estimation rules.
  Weekend/holiday adjustments, merchant-specific grace, annual schedules, and
  billing-frequency changes are not modeled.
- Evaluation uses UTC dates, not a user's or merchant's local billing timezone.
  A loaded page does not automatically refresh its observations at midnight.
- Current detection behavior, history lookback, authentication, RLS, and the
  development-only route guard are unchanged. This change performs no database
  writes and makes no Hosted Supabase or deployment changes.

## Verification coverage

Focused tests cover all statuses and exact boundaries, default/custom/zero grace,
fixed-day clamping without drift, month-end, leap years, year transitions,
invalid/future dates, input-order and clock independence, UTC/DST behavior,
multiple triples from one merchant, one-date server evaluation across midnight,
and server-rendered observation labels and limitations. Server integration tests
mock database retrieval; they are not live Plaid, database, or HTTP E2E tests.
