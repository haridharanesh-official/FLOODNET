import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "FLOODNET",
  description: "CCTV flood-road intelligence and dynamic rerouting",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
