import type { Metadata, Viewport } from "next";
import { inter } from "../fonts";

export const metadata: Metadata = {
  title: "AirConnect",
  description: "Call-centre agent CRM for clearing daily lead follow-ups fast.",
  robots: { index: false, follow: false },
};

// AirConnect is a desktop, landscape-first internal tool - fix the layout
// viewport so it never falls back to a shrunk mobile viewport.
export const viewport: Viewport = {
  width: "1280",
  initialScale: 1,
};

export default function AirConnectLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.variable} ${inter.className} airconnect-root fixed inset-0 flex flex-col bg-[var(--surface-primary)]`}>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
