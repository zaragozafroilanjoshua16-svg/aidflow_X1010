import type { Metadata } from "next";
import "./globals.css";
import { SiteNav, SiteFooter } from "@/components/site-nav";
export const metadata: Metadata = {
  title: { default: "AidFlow — Care in motion", template: "%s · AidFlow" },
  description:
    "Fictional disaster relief with traceable 90/10 payouts on Stellar Testnet.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <SiteNav />
        <div id="content">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
