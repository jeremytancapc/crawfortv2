import { CALC, CUSTOMER, LOAN, SCHEDULE, money } from "./data";

export type ContractPage = {
  sign: boolean;
  table?: [string, string][];
  bodyHtml: string;
};

function scheduleRowsHtml() {
  const rows = SCHEDULE.map(
    (r) =>
      `<tr><td>${r.n}</td><td>${r.date}</td><td>${money(r.amount)}</td><td>${money(r.principal)}</td><td>${money(r.interest)}</td></tr>`
  ).join("");
  return (
    rows +
    `<tr class="tot"><td colspan="2">Total</td><td>${money(CALC.totalRepay)}</td><td>${money(LOAN.amount)}</td><td>${money(CALC.interest)}</td></tr>`
  );
}

// NOTE: contains template literals with __SCHEDULE_ROWS__
const PAGE_CONTENT_BASE: ContractPage[] = [
  { // 1 - Loan Application
    sign:true,
    table:[['Name of Individual','{name}'],['Identification No. (NRIC)','{nric}'],['Nationality','{nationality}'],['Date of Birth','{dob}'],['Residential Address','{address}'],['Contact No.','{mobile}'],['Email','{email}'],['Annual Income','{income}'],['Loan Required','{amount}']],
    bodyHtml:`<p>This Loan Application is submitted under the Moneylenders Act (Chapter 188) to Crawfort Pte. Ltd., trading as <strong>CF Money Pte Ltd</strong> (UEN 201406595W, Licence No. 86/2025), 1 North Bridge Road #01-35 High Street Centre, Singapore 179094.</p>
      <p>The Borrower confirms that: (i) no other individual or company (a "Beneficial Borrower") will benefit from this loan; and (ii) the Borrower is not a politically-exposed person. Should either answer be "Yes", senior management approval would be required before this application proceeds.</p>`
  },
  { // 2 - Note of Contract: Important Info + T&Cs
    sign:false,
    bodyHtml:`<p><strong>Important Information for Borrower and Surety or their Agents</strong></p>
      <ol>
        <li>Do NOT sign or accept this Note of Contract if any part of it is not properly filled in, or if the moneylender (or agent) has not explained its terms to you in a language you understand.</li>
        <li>For a loan granted to an individual, the moneylender cannot charge: an upfront administrative fee of more than 10% of the loan principal; interest of more than 4% per month; late interest of more than 4% per month; or a total borrowing cost of more than 100% of the loan principal.</li>
        <li>Except for a revolving credit, secured, or business loan, repayment is made in equal instalments at equal intervals, with interest calculated on a reducing balance basis.</li>
        <li>You are advised to repay the principal and interest promptly on the agreed date to avoid incurring late interest and late fees.</li>
        <li>After signing, you should receive a copy of the duly completed Note of Contract and the loan repayment schedule.</li>
        <li>You should receive a receipt for every repayment made (whether in cash or otherwise).</li>
        <li>So long as your loan is subsisting, you should receive a statement of account every half year, by 21 July or 21 January.</li>
      </ol>
      <p><strong>Terms and Conditions</strong></p>
      <ol>
        <li>All amounts stated in this loan agreement are in Singapore Dollars.</li>
        <li>Interest charged is based on the nominal interest rate agreed at the time of application and grant of the loan.</li>
        <li>Any partial repayment is applied in the following order: (i) late repayment interest, if any; (ii) late repayment fee; (iii) interest; and (iv) principal.</li>
        <li>If the Borrower fails to pay promptly, defaults on any provision, makes an incorrect representation, has indebtedness unpaid when due, loses mental capacity or dies, or any circumstance arises which the Lender believes may adversely affect the Borrower's or Surety's ability to perform their obligations, the Lender may declare an event of default and demand immediate repayment of all sums due, and may terminate this agreement immediately.</li>
        <li>The Lender may elect to proceed with legal action against the Borrower and/or Surety, at its sole discretion.</li>
        <li>The Borrower and/or Surety shall bear all costs of recovering sums due, whether through legal action, debt collection agencies, or otherwise.</li>
        <li>No partial early redemption is allowed.</li>
        <li>The Lender may amend these terms at any time at its sole discretion, subject to the Moneylenders Act and its Rules. Amendments take effect once notice is sent to the Borrower's/Surety's last known address, or by other means selected by the Lender. If the Borrower/Surety does not accept the variation, they must inform the Lender in writing within 7 days, and the Lender may withdraw the loan.</li>
        <li>Any Surety is bound by the same terms as the Borrower and is fully liable for all sums due under this loan.</li>
        <li>The Borrower and Surety authorise the Lender to communicate by electronic means, post, or house visit, and to contact any person - including employers - to obtain and verify information required.</li>
        <li>This agreement is governed by the laws of the Republic of Singapore, and the parties submit irrevocably to the jurisdiction of the Singapore courts.</li>
        <li>The Lender may serve legal process by personal service or by leaving it at the Borrower's/Surety's last known address; such service is deemed good and effective.</li>
        <li>If any provision of this contract is illegal, invalid, or unenforceable, the remaining provisions remain valid and enforceable.</li>
        <li>No failure or delay in exercising any right shall operate as a waiver; no indulgence constitutes a waiver unless expressly made by the Lender in writing.</li>
        <li>The Borrower and Surety may not assign any rights, remedies, or obligations under this agreement without the Lender's express written approval.</li>
        <li>The Borrower agrees to disclose true copies of income or financial substantiation documents as required; such documents become and remain the Lender's property.</li>
        <li>The Borrower authorises the Lender to conduct credit checks and verify information given in this application with any person or authority, without further reference to the Borrower.</li>
        <li>The Borrower permits the Lender to disclose information relating to the Borrower, their accounts, and this application to any guarantor or surety, jointly liable persons, the Lender's subsidiaries/agents, government agencies, credit bureaus, and potential assignees.</li>
        <li>Notwithstanding Clause 7, the Lender may, at its sole discretion, waive Clause 7 and instead impose a full month's interest on any monthly loan in the event of an early redemption.</li>
        <li>Repayment method: PayNow.</li>
        <li>Any Surety (if any) will be subject to all terms and conditions imposed on the Borrower.</li>
        <li>This is a binding legal agreement. After reviewing and signing the contract, the Borrower must fulfil their obligations under it; no cancellation is allowed for any reason.</li>
        <li>The Lender shall issue receipts for repayments made by the Borrower or on the Borrower's behalf.</li>
        <li>The administrative fee, where charged, covers expenses associated with loan processing and customisation. Upon its payment, the Borrower acknowledges that all related services have been fully rendered.</li>
      </ol>`
  },
  { // 3 - Declarations
    sign:true,
    bodyHtml:`<p>I/We, the Borrower(s), desire to borrow from the Moneylender the sum of <strong>{amount}</strong> (the "Principal") and promise to repay the Principal together with interest at the nominal interest rate of <strong>3.92% monthly</strong> from the date of the loan until fully repaid, on a joint and several basis where applicable. I/We acknowledge receiving the Principal of {amount} from the Moneylender/Moneylender's agent.</p>
      <p>I/We acknowledge that I/we received a copy of this Note of Contract, including the repayment schedule, after it was signed and before/at the time the Principal was disbursed. I/We acknowledge that the Moneylender/agent has explained the Terms of Loan, Terms and Conditions, Important Information, and repayment schedule to me/us in a language I/we understand.</p>
      <p><strong>I/We declare that, at the time of this loan application, I/we:</strong></p>
      <ul>
        <li>have not filed for bankruptcy;</li>
        <li>am/are not an undischarged bankrupt under the Bankruptcy Act (Cap. 20);</li>
        <li>am/are not under any receivership, conservatorship, or formal restructuring arrangement, including the Debt Repayment Scheme (DRS) administered by the Official Assignee;</li>
        <li>am/are not currently undergoing, or planning to undergo, any debt restructuring, insolvency arrangement, or similar process.</li>
      </ul>
      <p><strong>I/We further declare that I/we do not intend to</strong>, within the next three (3) months from the date of this declaration: file for bankruptcy; apply to be assessed under the DRS; or enter into any form of debt restructuring or formal insolvency arrangement.</p>
      <p>I/We confirm that I/we have no foreknowledge of any actual or impending legal action, demand, or notice of intention by any party to recover outstanding debts, commence bankruptcy proceedings, or subject me/us to receivership, conservatorship, or the DRS, within the next three (3) months.</p>
      <p>I/We declare that all relevant information regarding my/our financial status and any legal proceedings has been disclosed; that all assets and liabilities have been accurately disclosed to the best of my/our knowledge; and that I/we consent to verification of this declaration by any authorised party or institution as deemed necessary.</p>
      <p><strong>I/We acknowledge that providing false or misleading information in this declaration may have legal consequences, including but not limited to liability for damages or criminal prosecution, and may be considered fraud against the Company</strong>, which may lodge a complaint or fraud case against me/us with the police, courts, liquidator, official assignee, or relevant authorities as it deems necessary.</p>
      <p>I/We declare that all information provided above is true and accurate.</p>`
  },
  { // 4 - Consent for Release of Information
    sign:true,
    bodyHtml:`<p>I, {name} (Singapore NRIC No. {nric}), hereby consent and authorise CF Money Pte Ltd to release all or some of my personal details and loan/contract details to the following companies, organisations, or parties, for the purpose of credit management, assessment, and debt recovery:</p>
      <ul>
        <li>Registry of Moneylenders</li>
        <li>Moneylenders Credit Bureau</li>
        <li>Credit Association of Singapore (CAS)</li>
        <li>Next of kin, or any third party contact number given by the Borrower, who may assist in loan recovery</li>
        <li>My employer, my company, and office colleagues, for the assistance of loan recovery</li>
        <li>Dun & Bradstreet (Singapore) Pte Ltd (D&B) and Credit Bureau (Singapore) Pte Ltd (CBS)</li>
        <li>CF Money Pte Ltd's authorised third-party debt collection agencies or approved debt collectors</li>
        <li>Any law firm engaged for recovery of the loan</li>
        <li>Other information-sharing portals for licensed moneylenders, and all other licensed moneylenders</li>
        <li>Third-party accountants/auditors, for accounting, auditing, and filing of required company documents to government agencies</li>
      </ul>
      <p>This information may include my personal particulars - name, identity card, photograph, passport or FIN number, home address, income, assets, liabilities, loan amount, interest rate, disbursement date, tenure, and loan servicing history. I authorise the Company to conduct credit checks and verify information given in this application with the above parties without prior reference to me, and I expressly permit the Company to disclose information relating to me, my accounts, and this application to the above parties, and to any guarantor, surety, or jointly liable person.</p>
      <p>I confirm that this consent has been read and clearly explained to me in a language I understand.</p>`
  },
  { // 5 - Cautionary Statement
    sign:true,
    bodyHtml:`<p>The Registrar of Moneylenders has become aware of undesirable conduct by some licensed moneylenders and has directed all licensed moneylenders to cease such conduct immediately, including:</p>
      <ul>
        <li>Offering a short-term loan of less than one month, with the intent of collecting more administrative fees, where the loan is repeatedly "renewed" and the Borrower keeps paying an administrative fee of up to 10% of the principal;</li>
        <li>Granting a loan or "re-loan" to renew or refinance an existing debt with the same moneylender with the intent of collecting more administrative fees;</li>
        <li>Splitting one loan into two or more smaller loans with the intent of collecting more late fees, so that a late fee (e.g. $60) is charged for each and every late smaller loan.</li>
      </ul>
      <p><strong>Beware of accepting such loans from licensed moneylenders.</strong> If your licensed moneylender has given you such a loan, please lodge a formal complaint with the Registrar of Moneylenders at 45 Maxwell Road, Level 7, The URA Centre (East Wing), Singapore 069118.</p>
      <p>By signing below, I, {name}, acknowledge that I have read and understood this cautionary statement, or if I cannot read it, that it has been explained to me and I have understood it.</p>`
  },
  { // 6 - Insolvency advisory
    sign:true,
    bodyHtml:`<p><strong>Unsuitability under the Debt Repayment Scheme (DRS).</strong> If you took a loan within 12 months before filing a bankruptcy application (or after doing so), and had no reasonable ground to expect you could repay it when you took it, the Official Assignee may find you unsuitable for the DRS and you may end up being made a bankrupt.</p>
      <p><strong>Bankruptcy Offences.</strong> If you are declared bankrupt and had earlier taken a loan - within 12 months before the bankruptcy application, or between the date of application and the bankruptcy order - without reasonable ground of expectation of being able to repay it, you may be guilty of an offence under the Insolvency, Restructuring & Dissolution Act 2018.</p>
      <p><strong>Cheating Offences.</strong> Should you borrow money with no intention to repay, the licensed moneylender may report you to the police, and you may be guilty of an offence of cheating under the Penal Code 1871.</p>
      <p>An online copy of this advisory is available at go.gov.sg/bankruptcy-offences. For queries, contact OneMinLaw at go.gov.sg/contactminlaw, or call 1800-2255-529 during office hours.</p>
      <p>By signing below, I, {name}, acknowledge that I have received, read, and understood this Insolvency-related Consequences and Offences Advisory, and that its contents have been explained to me in a language I understand.</p>`
  },
  { // 7 - Terms of Loan & Schedule
    sign:false,
    table:[['Loan Account No.','8018644C'],['Date of Loan','18-04-2026'],['Type of Loan','Unsecured'],['Purpose of Loan','Personal'],['Payment Frequency','Monthly'],['Loan Amount','{amount}'],['Admin Fee (10%)','{fee}'],['Disbursed Amount','{net}'],['Nominal Interest Rate','3.92% Monthly'],['Nominal Rate of Late Interest','4% Monthly'],['Number of Instalments','{tenure}'],['Instalment Amount','S$199.34'],['Late Payment Fee (per month)','S$60.00'],['Statement Request Fee','S$10.00']],
    bodyHtml:`<p>Interest is calculated on a reducing balance basis. Interest on the principal is credited on the due date, being the Borrower's salary date or a date otherwise mutually agreed between the Licensee and the Borrower. In the event of legal proceedings against the Borrower and/or Surety, the Borrower and/or Surety shall pay the legal costs incurred for recovery of the loan, as may be ordered by a court.</p>
      <p><strong>Schedule of Repayment</strong></p>
      <table class="sched"><thead><tr><th>No.</th><th>Date</th><th>Amount</th><th>Principal</th><th>Interest</th></tr></thead><tbody>__SCHEDULE_ROWS__</tbody></table>`
  }
];


export const PAGE_CONTENT: ContractPage[] = PAGE_CONTENT_BASE.map((page) => ({
  ...page,
  bodyHtml: page.bodyHtml.replace("__SCHEDULE_ROWS__", scheduleRowsHtml()),
}));

export function fillTemplate(str: string) {
  return str
    .replaceAll("{name}", CUSTOMER.name)
    .replaceAll("{nric}", CUSTOMER.nric)
    .replaceAll("{nationality}", CUSTOMER.nationality)
    .replaceAll("{dob}", CUSTOMER.dob)
    .replaceAll("{address}", CUSTOMER.address)
    .replaceAll("{mobile}", CUSTOMER.mobile)
    .replaceAll("{email}", CUSTOMER.email)
    .replaceAll("{income}", CUSTOMER.income)
    .replaceAll("{amount}", money(LOAN.amount))
    .replaceAll("{tenure}", String(LOAN.tenure))
    .replaceAll("{interest}", money(CALC.interest))
    .replaceAll("{fee}", money(CALC.fee))
    .replaceAll("{net}", money(CALC.net))
    .replaceAll("{monthly}", money(CALC.monthly));
}

export function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
