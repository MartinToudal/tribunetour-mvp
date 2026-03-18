import "./(site)/_styles/globals.css";
import 'leaflet/dist/leaflet.css';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tribunetour",
  description: "Find kampe, udforsk stadions og følg dine stadionbesøg.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <body>{children}</body>
    </html>
  );
}
