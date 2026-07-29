export const CUSTOMER = {
  name: "Khoo Wei Shen",
  nric: "S92••••33E",
  dob: "05 Jan 1992",
  nationality: "Malaysian",
  sex: "Male",
  mobile: "+65 8059••88",
  email: "weishen00••@gmail.com",
  address: "369 Bukit Batok Street 31, #07-519, Singapore 650369",
  occupation: "Warehouse Assistant",
  employer: "Bukit Batok Logistics Pte Ltd",
  income: "S$4,200 / month (Annual S$50,400.00)",
} as const;

export const SCHEDULE = [
  { n: 1, date: "18-05-2026", amount: 199.34, principal: 152.3, interest: 47.04 },
  { n: 2, date: "18-06-2026", amount: 199.34, principal: 158.27, interest: 41.07 },
  { n: 3, date: "18-07-2026", amount: 199.34, principal: 164.47, interest: 34.87 },
  { n: 4, date: "18-08-2026", amount: 199.34, principal: 170.92, interest: 28.42 },
  { n: 5, date: "18-09-2026", amount: 199.34, principal: 177.62, interest: 21.72 },
  { n: 6, date: "18-10-2026", amount: 199.34, principal: 184.58, interest: 14.76 },
  { n: 7, date: "18-11-2026", amount: 199.36, principal: 191.84, interest: 7.52 },
] as const;

export const LOAN = {
  amount: 1200,
  tenure: 7,
  rate: 0.0392,
  adminFeeRate: 0.1,
  loanAccountNo: "8024819P",
  dateOfLoan: "18-04-2026",
} as const;

export const CALC = {
  interest: 195.4,
  fee: 120,
  totalRepay: 1395.4,
  monthly: 199.34,
  net: 1080,
} as const;

export function money(n: number) {
  return (
    "S$" +
    Number(n).toLocaleString("en-SG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function moneyWhole(n: number) {
  return (
    "S$" +
    Number(n).toLocaleString("en-SG", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
}

export type LangCode = "en" | "zh" | "ta" | "ms";

export const LANGS: { code: LangCode; native: string; label: string }[] = [
  { code: "en", native: "English", label: "EN" },
  { code: "zh", native: "中文", label: "中文" },
  { code: "ta", native: "தமிழ்", label: "தமிழ்" },
  { code: "ms", native: "Bahasa Melayu", label: "BM" },
];
