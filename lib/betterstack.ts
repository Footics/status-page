const API = "https://uptime.betterstack.com/api/v2";
const HISTORY_DAYS = 45;
const CACHE_TTL_MS = 30_000;
const DAY_MS = 86_400_000;

export type ServiceState = "operational" | "degraded" | "down" | "maintenance";
export type DayState = ServiceState | "nodata";

export type DayCell = { date: string; state: DayState; uptimePct: number | null };

export type Service = {
  key: string;
  label: string;
  desc: string;
  state: ServiceState;
  availability: number | null;
  history: DayCell[];
};

export type StatusPayload = {
  ok: boolean | null;
  state: ServiceState | "unknown";
  services: Service[];
  updatedAt: string;
  error?: boolean;
};

const SEV: Record<ServiceState, number> = { operational: 0, maintenance: 1, degraded: 2, down: 3 };

function toState(status: string | undefined): ServiceState {
  switch (status) {
    case "down":
      return "down";
    case "paused":
    case "maintenance":
      return "maintenance";
    case "up":
    case "pending":
    case "validating":
    default:
      return "operational";
  }
}

type BsResource = {
  id: string;
  attributes?: { url?: string; status?: string; created_at?: string; started_at?: string; resolved_at?: string };
  relationships?: Record<string, { data?: { id?: string | number } | { id?: string | number }[] }>;
};

async function bsFetch(path: string): Promise<BsResource[]> {
  const token = process.env.BETTERSTACK_API_TOKEN;
  if (!token) throw new Error("BETTERSTACK_API_TOKEN manquant");
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`BetterStack ${path} -> ${res.status}`);
  const json = (await res.json()) as { data?: BsResource[] };
  return json.data ?? [];
}

type Incident = { startedAt: number; resolvedAt: number | null; serviceIds: string[] };

function parseIncidents(raw: BsResource[]): Incident[] {
  const out: Incident[] = [];
  for (const inc of raw) {
    const startedAt = inc.attributes?.started_at ? Date.parse(inc.attributes.started_at) : NaN;
    if (Number.isNaN(startedAt)) continue;
    const resolvedAt = inc.attributes?.resolved_at ? Date.parse(inc.attributes.resolved_at) : null;
    const serviceIds: string[] = [];
    for (const rel of Object.values(inc.relationships ?? {})) {
      const data = rel?.data;
      if (Array.isArray(data)) data.forEach((d) => d?.id != null && serviceIds.push(String(d.id)));
      else if (data?.id != null) serviceIds.push(String(data.id));
    }
    out.push({ startedAt, resolvedAt, serviceIds });
  }
  return out;
}

function downtimeMinutes(dayStart: number, incidents: Incident[], serviceId: string, now: number): number {
  const dayEnd = dayStart + DAY_MS;
  let down = 0;
  for (const inc of incidents) {
    if (!inc.serviceIds.includes(serviceId)) continue;
    const s = Math.max(inc.startedAt, dayStart);
    const e = Math.min(inc.resolvedAt ?? now, dayEnd);
    if (e > s) down += (e - s) / 60_000;
  }
  return down;
}

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function buildHistory(createdAt: number, serviceId: string, incidents: Incident[], now: number): DayCell[] {
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const cells: DayCell[] = [];
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const dayStart = todayStart.getTime() - i * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    const from = Math.max(dayStart, createdAt);
    const to = Math.min(dayEnd, now);
    const monitoredMin = (to - from) / 60_000;
    if (monitoredMin <= 0) {
      cells.push({ date: dayKey(dayStart), state: "nodata", uptimePct: null });
      continue;
    }
    const down = Math.min(downtimeMinutes(dayStart, incidents, serviceId, now), monitoredMin);
    const pct = Math.max(0, Math.min(100, (1 - down / monitoredMin) * 100));
    const state: DayState = pct >= 99.95 ? "operational" : pct >= 95 ? "degraded" : "down";
    cells.push({ date: dayKey(dayStart), state, uptimePct: Math.round(pct * 100) / 100 });
  }
  return cells;
}

let cache: { at: number; data: StatusPayload } | null = null;

export async function getStatus(): Promise<StatusPayload> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.data;

  const updatedAt = new Date(now).toISOString();
  try {
    const [monitors, heartbeats, incidentsRaw] = await Promise.all([
      bsFetch("/monitors"),
      bsFetch("/heartbeats"),
      bsFetch("/incidents?per_page=50"),
    ]);
    const incidents = parseIncidents(incidentsRaw);

    const sante = monitors.find((m) => (m.attributes?.url ?? "").includes("/api/health"));
    const site = monitors.find((m) => m !== sante && !(m.attributes?.url ?? "").includes("/api/"));
    const veilleur = heartbeats[0];

    const defs = [
      { key: "web", label: "Le site", desc: "L'accès à footics.app", res: site },
      { key: "api", label: "API & base de données", desc: "Le backend et la base (comptes, pronos, scores)", res: sante },
      { key: "veilleur", label: "Le Veilleur", desc: "Le suivi des matchs en direct", res: veilleur },
    ];

    const services: Service[] = defs.map((d) => {
      const id = d.res?.id ?? "";
      const createdAt = d.res?.attributes?.created_at ? Date.parse(d.res.attributes.created_at) : now;
      const history = id ? buildHistory(createdAt, id, incidents, now) : [];
      const monitored = history.filter((c) => c.uptimePct != null);
      const availability = monitored.length
        ? Math.round((monitored.reduce((sum, c) => sum + (c.uptimePct as number), 0) / monitored.length) * 100) / 100
        : null;
      return { key: d.key, label: d.label, desc: d.desc, state: toState(d.res?.attributes?.status), availability, history };
    });

    const state = services.reduce<ServiceState>((worst, s) => (SEV[s.state] > SEV[worst] ? s.state : worst), "operational");
    const data: StatusPayload = { ok: state === "operational", state, services, updatedAt };
    cache = { at: now, data };
    return data;
  } catch (err) {
    console.error("[status] BetterStack injoignable:", err);
    return { ok: null, state: "unknown", services: [], error: true, updatedAt };
  }
}
