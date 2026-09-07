/** Custom offer confirmation screen - loaded from ?leadId= after a customer
 *  requests an out-of-policy loan amount/tenure on /apply/choose-plan. */
export type CustomOfferDisplay = {
  leadId: string;
  fullName: string;
  amount: number;
  tenure: number;
};
