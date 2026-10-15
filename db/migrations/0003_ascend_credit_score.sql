-- creditLevel and creditScore, which a real /openApi/apply/credit response
-- carries and the schema had nowhere to put.
--
-- They are part of the decision record: when Ascend's numbers are later
-- compared against our own income engine (the reason credit_assessments still
-- exists after ADR-0001), the grade and score are what make the comparison
-- meaningful rather than just two limits side by side.
--
-- credit_score is NUMERIC, not an integer: the live response returned 588.26.

alter table ascend_orders
  add column credit_level text,
  add column credit_score numeric(8,2);

comment on column ascend_orders.credit_level is
  'Ascend credit grade, e.g. "A".';
comment on column ascend_orders.credit_score is
  'Ascend credit score. Fractional - a real response returned 588.26.';
