# Next.js Migration Plan

## Objective

Rebuild the existing Smart IV Drip Monitor dashboard as a Next.js application while preserving its user interface and interactions exactly. The first version will use local dummy data. Its data layer will be deliberately shaped so a future ESP32-over-Wi-Fi integration can replace the dummy source without changing dashboard components.

## Existing UI to Preserve

The current Flask dashboard is the visual and behavioral reference. The Next.js version must retain:

- the white clinical navigation bar, droplet mark, `WARD 01` badge, connection pill, sound toggle, and live clock;
- the five KPI cards: total beds, normal flow, low flow, critical/stopped, and active alerts;
- filter buttons, bed-ID search, live-sync indicator, and sync timestamp;
- responsive bed cards, including the status colour accents, moving volume bar, empty-time indicator, telemetry action, and critical-state pulse;
- the Ward Alert Monitor table, acknowledgement state/action, and empty state;
- the telemetry modal with four metrics, the trend chart, incident list, and close controls;
- the Plus Jakarta Sans and JetBrains Mono typography, Bootstrap Icons, spacing, breakpoints, colours, shadows, rounded corners, hover effects, and responsive layout from the existing dashboard.

The source of truth for visual parity is:

- `smart_iv_monitor/templates/dashboard.html`
- `smart_iv_monitor/static/css/style.css`
- `smart_iv_monitor/static/js/dashboard.js`

## Target Stack

- Next.js with the App Router and TypeScript.
- React client components for dashboard state and browser-only features.
- Existing Bootstrap 5 styles and Bootstrap Icons initially, so the visual system can be carried over accurately. Move existing custom CSS to a global stylesheet with only the smallest selector changes required by React.
- Chart.js with `react-chartjs-2`, loaded client-side so server rendering never accesses `window` or canvas.
- Local TypeScript mock repository for the first milestone; no Flask dependency in the running UI.

## Proposed Folder Layout

```text
Next-migration/
  app/
    layout.tsx
    page.tsx
    globals.css
  components/
    dashboard/
      DashboardClient.tsx
      ClinicalHeader.tsx
      KpiSummary.tsx
      FilterToolbar.tsx
      BedGrid.tsx
      BedCard.tsx
      AlertsPanel.tsx
      TelemetryModal.tsx
      ClinicalFooter.tsx
  lib/
    types.ts
    formatters.ts
    status.ts
    dummy-data.ts
    telemetry-repository.ts
  public/
  package.json
  tsconfig.json
  next.config.ts
```

`DashboardClient` will be the single state owner. Presentational components receive typed data and callbacks, keeping each visual section easy to compare against the Flask template.

## Data Contract

Create stable TypeScript models that mirror the current API responses:

```ts
type BedStatus = "NORMAL" | "LOW_FLOW" | "CRITICAL";

interface Bed {
  id: number;
  bedId: string;
  dropRate: number;
  currentVolume: number;
  bottleCapacity: number;
  status: BedStatus;
  remainingPercent: number;
  estimatedEmptyMinutes: number | null;
  lastUpdated: string;
}

interface Alert {
  id: number;
  bedId: string;
  alertType: "LOW_FLOW" | "CRITICAL";
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

interface Reading {
  timestamp: string;
  dropRate: number;
}
```

Use a `TelemetryRepository` interface with `getHealth`, `getBeds`, `getAlerts`, `getReadings`, and `acknowledgeAlert`. The first implementation will return seeded dummy beds, alerts, and rolling readings, updating values every two seconds to preserve the current live-dashboard feel. A later HTTP implementation can call the existing REST endpoints or a Next.js route handler without altering UI components.

## Implementation Sequence

1. Scaffold the isolated TypeScript Next.js app in this directory and add its local development scripts. Do not modify the working Flask app.
2. Copy the current font imports, Bootstrap dependencies, Bootstrap Icons, and custom CSS into the Next.js global styling entry point. Replace only Flask/static asset paths and selectors that conflict with React.
3. Define the telemetry models, status metadata, time/volume formatting helpers, and seeded dummy data. Include normal, low-flow, and critical beds plus acknowledged and active alerts.
4. Implement the dashboard shell in the same document order as `dashboard.html`: header, KPI summary, toolbar, grid, alerts, modal, footer.
5. Build bed filtering and search as React state. Derive KPI and filter counts from the active bed collection rather than hard-coding values.
6. Add a client-side two-second dummy-data refresh cycle, a local clock, connection badge, alert-ping logic, and browser audio toggle. Keep initial dummy data deterministic enough for repeatable visual checks.
7. Implement alert acknowledgement as an in-memory repository mutation. Refresh the alert counters and table immediately after acknowledgement.
8. Implement the telemetry modal and the 30-reading Chart.js line graph. Ensure modal reopening changes the selected bed, and the chart updates without remount flicker.
9. Compare the running Next.js page beside the Flask dashboard at desktop, tablet, and mobile widths. Adjust CSS only where screenshots reveal a mismatch.
10. Add concise component/unit checks for data formatting, filtering, acknowledgement, and repository behavior. Add an end-to-end smoke check for opening the dashboard, filtering a bed, opening telemetry, and acknowledging an alert.

## Visual-Parity Acceptance Checks

- At the existing desktop dashboard width, all sections occur in the same order and use equivalent dimensions, typography, colours, and spacing.
- The five summary cards, four toolbar filters, three status variations, alert rows, modal, and footer match the existing UI states.
- At mobile widths, the current Bootstrap responsive column behavior remains intact.
- Search and filters produce the same empty state as the Flask version.
- A low-flow and critical alert remain visually distinguishable in both card and table states.
- The dashboard shows three seeded beds on first load and continues to update the displayed timestamp/data every two seconds.

## Future ESP32/Wi-Fi Connection Path

When hardware work begins, implement a server-side ingestion route that accepts the current ESP32 payload (`bed_id`, `drop_rate`, `current_volume`, `bottle_capacity`). Validate and normalize it, calculate status/predictions on the server, and persist or cache readings. Replace only the dummy `TelemetryRepository` implementation with one that fetches the new route. The dashboard’s models, components, filters, modal, chart, and visual design remain unchanged.

## Definition of Done for the Migration

The Next.js project runs independently inside `Next-migration`, presents a visually identical dashboard using dummy telemetry, supports every current dashboard interaction, and has a clear repository boundary ready for the later ESP32 data source.
