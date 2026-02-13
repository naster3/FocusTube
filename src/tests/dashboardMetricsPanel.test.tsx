// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import type { Metrics } from "../domain/settings/types";
import type { AdvancedData, ChartSeries, MetricsTableRow, PieSeries, SummaryData } from "../ui/dashboard/types";
import { MetricsPanel } from "../ui/dashboard/components/MetricsPanel";

const noop = () => undefined;

const clearBody = () => {
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
};

function renderPanel(ui: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, root };
}

describe("MetricsPanel UI", () => {
  afterEach(() => {
    clearBody();
  });

  it("renders table rows for recent days", () => {
    const metrics: Metrics = {
      version: 2,
      attemptsByDay: { "2024-01-10": 2 },
      timeByDay: { "2024-01-10": 120 },
      blockedTimeByDay: {},
      sessionsByDay: { "2024-01-10": 1 },
      timeByDomainByDay: { "2024-01-10": { "youtube.com": 120 } },
      lastAttemptAt: null,
      lastUpdatedAt: null
    };
    const tableRows: MetricsTableRow[] = [
      {
        day: "2024-01-10",
        attempts: 2,
        time: 120,
        sessions: 1,
        topDomainLabel: "youtube.com (120)"
      }
    ];
    const summaryData: SummaryData | null = null;
    const advancedData: AdvancedData | null = null;
    const chartSeries: ChartSeries | null = null;
    const pieSeries: PieSeries | null = null;

    const { container, root } = renderPanel(
      <MetricsPanel
        language="en"
        metrics={metrics}
        metricsTab="table"
        summaryData={summaryData}
        advancedData={advancedData}
        chartSeries={chartSeries}
        pieSeries={pieSeries}
        attemptsTodayAnim={0}
        timeTodayAnim={0}
        sessionsTodayAnim={0}
        attemptsWeekAnim={0}
        timeWeekAnim={0}
        sessionsWeekAnim={0}
        last30AttemptsAnim={0}
        last30TimeAnim={0}
        tableRows={tableRows}
        onMetricsTabChange={noop}
        onExportMetrics={noop}
        onResetMetrics={noop}
        onSummaryRef={noop}
        attemptsCanvasRef={{ current: null }}
        timeCanvasRef={{ current: null }}
        pieCanvasRef={{ current: null }}
        formatSeconds={(value) => `${value}`}
        percentDelta={() => "0%"}
        deltaClass={() => "neutral"}
      />
    );

    const rows = container.querySelectorAll(".table .row");
    expect(rows.length).toBe(tableRows.length + 1);
    act(() => root.unmount());
  });

  it("renders summary cards when summary data is available", () => {
    const metrics: Metrics = {
      version: 2,
      attemptsByDay: {},
      timeByDay: {},
      blockedTimeByDay: {},
      sessionsByDay: {},
      timeByDomainByDay: {},
      lastAttemptAt: null,
      lastUpdatedAt: null
    };
    const summaryData: SummaryData = {
      attemptsToday: 1,
      timeToday: 60,
      sessionsToday: 1,
      attemptsWeek: 5,
      attemptsPrev: 3,
      timeWeek: 300,
      timePrev: 200,
      sessionsWeek: 2,
      sessionsPrev: 1,
      last30Attempts: 10,
      last30Time: 600,
      todayLabel: "Today",
      weekLabel: "Week",
      monthLabel: "Month"
    };

    const { container, root } = renderPanel(
      <MetricsPanel
        language="en"
        metrics={metrics}
        metricsTab="summary"
        summaryData={summaryData}
        advancedData={null}
        chartSeries={null}
        pieSeries={null}
        attemptsTodayAnim={1}
        timeTodayAnim={60}
        sessionsTodayAnim={1}
        attemptsWeekAnim={5}
        timeWeekAnim={300}
        sessionsWeekAnim={2}
        last30AttemptsAnim={10}
        last30TimeAnim={600}
        tableRows={[]}
        onMetricsTabChange={noop}
        onExportMetrics={noop}
        onResetMetrics={noop}
        onSummaryRef={noop}
        attemptsCanvasRef={{ current: null }}
        timeCanvasRef={{ current: null }}
        pieCanvasRef={{ current: null }}
        formatSeconds={(value) => `${value}`}
        percentDelta={() => "0%"}
        deltaClass={() => "neutral"}
      />
    );

    expect(container.querySelector(".summary")).not.toBeNull();
    act(() => root.unmount());
  });
});
