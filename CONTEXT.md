# Crawfort Loan Application

The customer-facing journey for an unsecured personal loan in Singapore: from an
anonymous amount enquiry, through identity and income verification, to a signed
offer and a booked appointment.

## Language

### Parties and systems

**Applicant**:
A person progressing through the apply funnel who has not yet signed an offer.
_Avoid_: User, lead, borrower

**Borrower**:
An applicant whose loan has been disbursed.
_Avoid_: Customer (too vague — say Applicant or Borrower)

**Ascend**:
The lending system of record. It owns the credit decision and, once an
application exists, the loan itself.
_Avoid_: Core system, backend, lender

**AirConnect**:
The internal CRM that owns leads and branch appointments. It does not make
credit decisions.

**MyInfo**:
The Singpass-provided personal and income data for an applicant, retrieved with
that applicant's consent.
_Avoid_: Singpass data (Singpass is the identity provider; MyInfo is the data)

**SCCB**:
The consumer credit bureau record for an applicant.

**MLCB**:
The Moneylenders Credit Bureau — the industry register of an applicant's
borrowing across all licensed moneylenders in Singapore.

### Applicant history

**New Customer**:
An applicant with no prior loan in Ascend. Ascend is the only authority on this;
it is never inferred from our own records.

**Reloan Customer**:
An applicant who has held a loan in Ascend before, whether or not it is settled.
_Avoid_: Existing customer, repeat customer, returning customer

### Amounts

Four distinct amounts exist and must never be collapsed into one.

**Desired Amount**:
What the applicant asks for. Collected at the start of the funnel, before any
verification.
_Avoid_: Requested amount, loan amount

**A-Card Limit**:
The amount Ascend is willing to lend this applicant. This is the final authority
on what can be borrowed, and it is the ceiling the applicant selects against.
_Avoid_: Credit limit (ambiguous — say A-Card Limit or Display Ceiling)

**Maximum Loan Quantum**:
The regulatory ceiling across all licensed moneylenders, reported by MLCB. It
constrains the A-Card Limit but is not itself an offer; it is what the applicant
could unlock.
_Avoid_: MLCB limit, max loan

**Underwritten Cap**:
The loan ceiling our own income engine derives from CPF, NOA, or declared
income. Retained for analytics and comparison against the A-Card Limit; it does
not decide what the applicant is offered.
_Avoid_: Max eligible loan, approved amount

### Decisions

**Risk Status**:
Ascend's verdict on an application — passed, pending, or rejected. Distinct from
whether an applicant is eligible to apply at all.

**Eligibility**:
Whether an applicant may proceed through the funnel at all — age, residency,
income floor, and blacklisting. Decided before any credit decision.
