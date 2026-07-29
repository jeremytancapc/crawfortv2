import type { Metadata } from "next";
import { RetailView } from "./retail-view";

export const metadata: Metadata = {
  title: "Retail | Crawfort",
  description: "Retail outlet CRM — queue management, walk-in registration, and loan management.",
};

export default function RetailPage() {
  return <RetailView />;
}
