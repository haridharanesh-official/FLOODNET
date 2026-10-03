"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navLinks = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/roads", label: "Road Controls" },
    { href: "/admin/cameras", label: "CCTV Cameras" },
    { href: "/admin/alerts", label: "Live Alerts" },
    { href: "/admin/system", label: "System Health" },
  ];

  return (
    <div className="adminLayout">
      <header className="adminHeader">
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "1.3rem" }}>🌊</span>
            <span style={{ fontWeight: 900, fontSize: "1.1rem", color: "#38bdf8", letterSpacing: "-0.02em" }}>
              FLOODNET ADMIN
            </span>
          </div>
          <span
            style={{
              background: "rgba(2, 132, 199, 0.2)",
              color: "#38bdf8",
              fontSize: "0.7rem",
              fontWeight: 800,
              padding: "3px 8px",
              borderRadius: "6px",
              letterSpacing: "0.05em",
            }}
          >
            OPERATIONS & SIMULATOR
          </span>
        </div>

        <nav className="adminNavTabs">
          {navLinks.map((link) => {
            const isActive =
              link.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`adminTabLink ${isActive ? "active" : ""}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div>
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "#0284c7",
              color: "#ffffff",
              padding: "8px 16px",
              borderRadius: "8px",
              fontSize: "0.82rem",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            🗺️ <span>Back to Navigation Map</span>
          </Link>
        </div>
      </header>

      <main className="adminContent">{children}</main>
    </div>
  );
}
