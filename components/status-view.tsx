"use client";

import { useEffect, useState } from "react";
import type { DayCell, DayState, Service, ServiceState, StatusPayload } from "@/lib/betterstack";

const DOT: Record<ServiceState, string> = {
  operational: "var(--footics-primary)",
  degraded: "var(--footics-gold)",
  down: "var(--footics-error)",
  maintenance: "var(--footics-info)",
};

const CELL: Record<DayState, string> = {
  operational: "var(--footics-primary)",
  degraded: "var(--footics-gold)",
  down: "var(--footics-error)",
  maintenance: "var(--footics-info)",
  nodata: "var(--footics-border)",
};

const STATE_LABEL: Record<ServiceState, string> = {
  operational: "Opérationnel",
  degraded: "Ralenti",
  down: "Indisponible",
  maintenance: "Maintenance",
};

const HEADLINE: Record<ServiceState, { title: string; bg: string; fg: string }> = {
  operational: { title: "Tous les systèmes sont opérationnels", bg: "var(--footics-primary-soft)", fg: "var(--footics-primary-deep)" },
  degraded: { title: "Service partiellement ralenti", bg: "#fbeccb", fg: "var(--footics-gold-deep)" },
  down: { title: "Incident en cours", bg: "#f7dcdc", fg: "var(--footics-error)" },
  maintenance: { title: "Maintenance en cours", bg: "#dceaff", fg: "var(--footics-info)" },
};

function cellTitle(c: DayCell): string {
  if (c.state === "nodata") return `${c.date} · pas de données`;
  return `${c.date} · ${c.uptimePct}% de disponibilité`;
}

function Heatmap({ history }: { history: DayCell[] }) {
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "stretch" }}>
      {history.map((c) => (
        <div
          key={c.date}
          title={cellTitle(c)}
          style={{ flex: 1, minWidth: 2, height: 30, borderRadius: 2, background: CELL[c.state] }}
        />
      ))}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, color: "var(--footics-ink-3)", transform: open ? "rotate(180deg)" : undefined, transition: "transform .18s ease" }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ServiceItem({ s, first }: { s: Service; first: boolean }) {
  const [open, setOpen] = useState(false);
  const hasHistory = s.history.length > 0;

  return (
    <div style={{ borderTop: first ? undefined : "1px solid var(--footics-border-soft)" }}>
      <button
        type="button"
        onClick={() => hasHistory && setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "16px 18px",
          background: "none",
          border: "none",
          textAlign: "left",
          cursor: hasHistory ? "pointer" : "default",
          font: "inherit",
          color: "inherit",
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: 999, background: DOT[s.state], flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--footics-ink)" }}>{s.label}</div>
          <div style={{ fontSize: 12.5, color: "var(--footics-ink-3)", marginTop: 1 }}>{s.desc}</div>
        </div>
        {s.availability != null && (
          <span className="footics-mono" style={{ fontSize: 12, color: "var(--footics-ink-3)", flexShrink: 0 }}>
            {s.availability}%
          </span>
        )}
        <span
          className="footics-cap"
          style={{ color: DOT[s.state], background: `color-mix(in srgb, ${DOT[s.state]} 12%, transparent)`, padding: "5px 9px", borderRadius: 999, flexShrink: 0 }}
        >
          {STATE_LABEL[s.state]}
        </span>
        {hasHistory && <Chevron open={open} />}
      </button>

      {open && hasHistory && (
        <div style={{ padding: "2px 18px 18px" }}>
          <Heatmap history={s.history} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, fontSize: 11, color: "var(--footics-ink-3)" }}>
            <span>il y a 45 jours</span>
            {s.availability != null && (
              <span className="footics-mono">{s.availability}% de disponibilité</span>
            )}
            <span>aujourd&apos;hui</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100vh", background: "var(--footics-bg)", padding: "48px 20px 80px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 22 }}>
          <a href="https://footics.app" className="footics-display" style={{ fontSize: 22, color: "var(--footics-ink)", textDecoration: "none" }}>
            footics
          </a>
          <span className="footics-cap" style={{ color: "var(--footics-ink-3)" }}>
            État des services
          </span>
        </header>
        {children}
      </div>
    </main>
  );
}

export function StatusView({ initial }: { initial: StatusPayload }) {
  const [data, setData] = useState<StatusPayload>(initial);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as StatusPayload;
        if (alive) setData(next);
      } catch {}
    };
    const id = setInterval(poll, 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  if (data.error || data.state === "unknown" || data.services.length === 0) {
    return (
      <Shell>
        <section style={{ padding: "18px 20px", borderRadius: 18, background: "var(--footics-surface)", border: "1px solid var(--footics-border)", boxShadow: "var(--footics-shadow-card)", color: "var(--footics-ink-3)", fontSize: 14 }}>
          Statut momentanément indisponible — on réessaie automatiquement.
        </section>
      </Shell>
    );
  }

  const state = data.state as ServiceState;
  const head = HEADLINE[state] ?? HEADLINE.operational;
  const checkedAt = new Date(data.updatedAt);

  return (
    <Shell>
      <section style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", borderRadius: 18, background: head.bg, color: head.fg, boxShadow: "var(--footics-shadow-card)" }}>
        <span style={{ width: 12, height: 12, borderRadius: 999, background: DOT[state], flexShrink: 0, animation: state === "operational" ? undefined : "footics-pulse 1.6s ease-in-out infinite" }} />
        <div className="footics-display" style={{ fontSize: 18, fontWeight: 700 }}>
          {head.title}
        </div>
      </section>

      <section style={{ marginTop: 18, borderRadius: 18, background: "var(--footics-surface)", border: "1px solid var(--footics-border)", boxShadow: "var(--footics-shadow-card)", overflow: "hidden" }}>
        {data.services.map((s, i) => (
          <ServiceItem key={s.key} s={s} first={i === 0} />
        ))}
      </section>

      <footer style={{ marginTop: 22, fontSize: 12, color: "var(--footics-ink-3)", lineHeight: 1.6 }}>
        <p style={{ margin: 0 }}>
          Page de statut <strong>indépendante</strong> : hébergée hors de l'infrastructure Footics et alimentée par une sonde
          externe — elle reste consultable même si footics.app est totalement injoignable. Clique sur un service pour voir
          son historique de disponibilité.
        </p>
        <p style={{ margin: "8px 0 0" }}>
          Dernière mise à jour :{" "}
          <time dateTime={checkedAt.toISOString()} className="footics-mono">
            {checkedAt.toLocaleString("fr-BE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Brussels" })}
          </time>
        </p>
      </footer>
    </Shell>
  );
}
