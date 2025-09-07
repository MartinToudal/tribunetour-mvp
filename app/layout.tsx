import "./(site)/_styles/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TribuneTour",
  description: "Besøg alle danske divisionsklubbers hjemmebaner – og del anmeldelser.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <body>{children}</body>
    </html>
  );
}
