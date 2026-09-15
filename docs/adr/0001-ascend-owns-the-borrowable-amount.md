# Ascend owns the borrowable amount

Until now the amount a customer could borrow was decided in this codebase: an
income engine derived a cap from CPF, NOA or declared income, and the gauge the
customer dragged against showed a different number again — a 6x-income display
heuristic unrelated to that cap. We are making Ascend's `creditLimit` (A-Card)
the single authority on what can be borrowed, bounded by MLCB's
`mlcbMaxLoanAmount`, because Ascend is the lending system of record and already
holds the bureau data our local engine was approximating.

## Consequences

- **The local income engine stays, but stops deciding.** `assessCredit()` keeps
  running and its Underwritten Cap is still persisted, now purely for comparison
  against what Ascend returns. Do not delete it — it is how we will find out
  whether Ascend's numbers behave as expected in production.

- **The funnel becomes able to reject people.** Submit currently forces every
  Singpass applicant to approval with a floor of $500, so the Singpass path
  cannot decline anyone. With Ascend authoritative, a `riskStatus` of `REJECT`
  must route to the pending page instead, and that clamp has to go.

- **An Ascend outage stops the journey.** The other external calls in this
  codebase deliberately never block — a failed eligibility check returns
  `PENDING` and the customer continues. This one cannot: without Ascend there is
  no amount to show, so the customer sees a failure state.

- **Applying creates an order.** `/openApi/apply/credit` is not a quote — it
  returns an `orderId` that signing and disbursement then consume. It must be
  called once per applicant, guarded by a persisted `orderId`, never on render
  and never speculatively.

- **Reloan detection moves off a string match.** Today a returning borrower is
  identified by `notes.includes("ascend")` against AirConnect's free-text field.
  Ascend reports `newCustomer` directly, so that heuristic and the
  `airconnect_reloan` rejection code both retire.

- **Reloan customers leave the web funnel.** A returning borrower is sent to the
  mobile app rather than shown an online offer. Because this is decided by the
  cheap `/openApi/users` lookup straight after MyInfo, they never reach
  `/openApi/apply/credit` — no order is created and no credit pull is spent on
  someone who was always going to be redirected.
