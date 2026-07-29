import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Loan Drawdown Kiosk",
  description: "In-branch loan drawdown kiosk for Crawfort customers.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function KioskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
