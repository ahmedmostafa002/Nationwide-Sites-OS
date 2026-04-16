import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nationwide Local-Site Generator Studio",
  description: "Internal studio for building multi-location niche sites."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
