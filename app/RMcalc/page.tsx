import type { Metadata } from "next";
import { RmCalcView } from "./rm-calc-view";

export const metadata: Metadata = {
  title: "Loan Calculator",
  description: "Staff loan repayment simulator.",
};

export default function RmCalcPage() {
  return <RmCalcView />;
}
