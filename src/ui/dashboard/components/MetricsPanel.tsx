import React from "react";
import { t } from "../../../shared/i18n";
import type { Metrics, Settings } from "../../../domain/settings/types";
import type { AdvancedData, ChartSeries, MetricsTableRow, PieSeries, SummaryData } from "../types";
import { EmptyState } from "../../shared/components/EmptyState";

type MetricsTab = "summary" | "charts" | "table" | "advanced";

type MetricsPanelProps = {
  language: Settings["language"];
  metrics: Metrics | null;
  metricsTab: MetricsTab;
  summaryData: SummaryData | null;
  advancedData: AdvancedData | null;
  chartSeries: ChartSeries | null;
  pieSeries: PieSeries | null;
  attemptsTodayAnim: number;
  timeTodayAnim: number;
  sessionsTodayAnim: number;
  attemptsWeekAnim: number;
  timeWeekAnim: number;
  sessionsWeekAnim: number;
  last30AttemptsAnim: number;
  last30TimeAnim: number;
  tableRows: MetricsTableRow[];
  onMetricsTabChange: (tab: MetricsTab) => void;
  onExportMetrics: () => void;
  onResetMetrics: () => void;
  onSummaryRef: (el: HTMLDivElement | null) => void;
  attemptsCanvasRef: React.RefObject<HTMLCanvasElement>;
  timeCanvasRef: React.RefObject<HTMLCanvasElement>;
  pieCanvasRef: React.RefObject<HTMLCanvasElement>;
  formatSeconds: (value: number) => string;
  percentDelta: (current: number, previous: number) => string;
  deltaClass: (current: number, previous: number) => string;
};

export function MetricsPanel({
  language,
  metrics,
  metricsTab,
  summaryData,
  advancedData,
  chartSeries,
  pieSeries,
  attemptsTodayAnim,
  timeTodayAnim,
  sessionsTodayAnim,
  attemptsWeekAnim,
  timeWeekAnim,
  sessionsWeekAnim,
  last30AttemptsAnim,
  last30TimeAnim,
  tableRows,
  onMetricsTabChange,
  onExportMetrics,
  onResetMetrics,
  onSummaryRef,
  attemptsCanvasRef,
  timeCanvasRef,
  pieCanvasRef,
  formatSeconds,
  percentDelta,
  deltaClass
}: MetricsPanelProps) {
  return (
    <section className="panel" data-guide="metrics">
      <div className="metrics-header">
        <h3>{t(language, "dashboard.metrics.title")}</h3>
        <div className="metrics-controls">
          <div className="metrics-nav" data-guide="metrics-tabs">
            <button
              type="button"
              className={`metrics-tab ${metricsTab === "summary" ? "active" : ""}`}
              onClick={() => onMetricsTabChange("summary")}
            >
              {t(language, "dashboard.metrics.tab.summary")}
            </button>
            <button
              type="button"
              className={`metrics-tab ${metricsTab === "charts" ? "active" : ""}`}
              onClick={() => onMetricsTabChange("charts")}
            >
              {t(language, "dashboard.metrics.tab.charts")}
            </button>
            <button
              type="button"
              className={`metrics-tab ${metricsTab === "table" ? "active" : ""}`}
              onClick={() => onMetricsTabChange("table")}
            >
              {t(language, "dashboard.metrics.tab.table")}
            </button>
            <button
              type="button"
              className={`metrics-tab ${metricsTab === "advanced" ? "active" : ""}`}
              onClick={() => onMetricsTabChange("advanced")}
            >
              {t(language, "dashboard.metrics.tab.advanced")}
            </button>
          </div>
        </div>
      </div>
      {!metrics ? (
        <div className="metrics-skeleton" role="status" aria-live="polite" aria-label={t(language, "dashboard.metrics.loading")}>
          <div className="metrics-skeleton-row w-70" />
          <div className="metrics-skeleton-row" />
          <div className="metrics-skeleton-row w-45" />
          <div className="metrics-skeleton-row" />
        </div>
      ) : (
        <div className="dashboard metrics-content" key={`metrics-${metricsTab}`}>
          {metricsTab === "summary" && summaryData ? (
            <div className="summary" ref={onSummaryRef}>
              <div className="summary-card metric-card metric-attempts">
                <div className="summary-header">
                  <div>
                    <h4>{t(language, "dashboard.metrics.today")}</h4>
                    <span className="summary-sub">{summaryData.todayLabel}</span>
                  </div>
                </div>
                <div className="metric-row">
                  <span className="metric-label">{t(language, "dashboard.metrics.attempts")}</span>
                  <span className="metric-value">{Math.round(attemptsTodayAnim)}</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">{t(language, "dashboard.metrics.time")}</span>
                  <span className="metric-value">{formatSeconds(Math.round(timeTodayAnim))}</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">{t(language, "dashboard.metrics.sessions")}</span>
                  <span className="metric-value">{Math.round(sessionsTodayAnim)}</span>
                </div>
                <div className="summary-note">{t(language, "dashboard.metrics.note.today")}</div>
              </div>
              <div className="summary-card metric-card metric-time">
                <div className="summary-header">
                  <div>
                    <h4>{t(language, "dashboard.metrics.last7")}</h4>
                    <span className="summary-sub">{summaryData.weekLabel}</span>
                  </div>
                </div>
                <div className="metric-row">
                  <span className="metric-label">{t(language, "dashboard.metrics.attempts")}</span>
                  <span className="metric-value">{Math.round(attemptsWeekAnim)}</span>
                  <span className={`metric-delta ${deltaClass(summaryData.attemptsWeek, summaryData.attemptsPrev)}`}>
                    {percentDelta(summaryData.attemptsWeek, summaryData.attemptsPrev)}
                  </span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">{t(language, "dashboard.metrics.time")}</span>
                  <span className="metric-value">{formatSeconds(Math.round(timeWeekAnim))}</span>
                  <span className={`metric-delta ${deltaClass(summaryData.timeWeek, summaryData.timePrev)}`}>
                    {percentDelta(summaryData.timeWeek, summaryData.timePrev)}
                  </span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">{t(language, "dashboard.metrics.sessions")}</span>
                  <span className="metric-value">{Math.round(sessionsWeekAnim)}</span>
                  <span className={`metric-delta ${deltaClass(summaryData.sessionsWeek, summaryData.sessionsPrev)}`}>
                    {percentDelta(summaryData.sessionsWeek, summaryData.sessionsPrev)}
                  </span>
                </div>
                <div className="summary-note">{t(language, "dashboard.metrics.note.last7")}</div>
              </div>
              <div className="summary-card metric-card metric-sessions">
                <div className="summary-header">
                  <div>
                    <h4>{t(language, "dashboard.metrics.last30")}</h4>
                    <span className="summary-sub">{summaryData.monthLabel}</span>
                  </div>
                </div>
                <div className="metric-row">
                  <span className="metric-label">{t(language, "dashboard.metrics.attempts")}</span>
                  <span className="metric-value">{Math.round(last30AttemptsAnim)}</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">{t(language, "dashboard.metrics.time")}</span>
                  <span className="metric-value">{formatSeconds(Math.round(last30TimeAnim))}</span>
                </div>
                <div className="summary-note">{t(language, "dashboard.metrics.note.last30")}</div>
              </div>
            </div>
          ) : null}

          {metricsTab === "charts" ? (
            chartSeries && (chartSeries.attempts.some((value) => value > 0) || chartSeries.times.some((value) => value > 0)) ? (
              <div className="charts">
                <div className="chart metric-attempts">
                  <h4>{t(language, "dashboard.metrics.attempts_day")}</h4>
                  <div className="chart-canvas">
                    <canvas ref={attemptsCanvasRef} />
                  </div>
                </div>
                <div className="chart metric-time">
                  <h4>{t(language, "dashboard.metrics.time_day")}</h4>
                  <div className="chart-canvas">
                    <canvas ref={timeCanvasRef} />
                  </div>
                </div>
                <div className="chart metric-pie">
                  <h4>{t(language, "dashboard.metrics.pie.title")}</h4>
                  {pieSeries && pieSeries.values.length > 0 ? (
                    <div className="chart-canvas pie">
                      <canvas ref={pieCanvasRef} />
                    </div>
                  ) : (
                    <EmptyState
                      className="metrics-empty small"
                      icon=""
                      title={t(language, "dashboard.metrics.pie.empty")}
                    />
                  )}
                </div>
              </div>
            ) : (
              <EmptyState
                className="metrics-empty"
                title={t(language, "dashboard.metrics.empty.title")}
                description={t(language, "dashboard.metrics.empty.desc")}
              />
            )
          ) : null}

          {metricsTab === "table" ? (
            <div className="table">
              <div className="row header">
                <span>{t(language, "dashboard.metrics.table.date")}</span>
                <span>{t(language, "dashboard.metrics.attempts")}</span>
                <span>{t(language, "dashboard.metrics.time")}</span>
                <span>{t(language, "dashboard.metrics.sessions")}</span>
                <span>{t(language, "dashboard.metrics.table.top_domain")}</span>
              </div>
              {tableRows.map((row) => (
                <div className="row" key={row.day}>
                  <span>{row.day}</span>
                  <span>{row.attempts}</span>
                  <span>{formatSeconds(row.time)}</span>
                  <span>{row.sessions}</span>
                  <span>{row.topDomainLabel}</span>
                </div>
              ))}
            </div>
          ) : null}

          {metricsTab === "advanced" ? (
            <div className="advanced">
              {advancedData ? (
                <>
                  <div className="advanced-grid">
                    <div className="summary-card metric-card metric-attempts">
                      <div className="summary-header">
                        <div>
                          <h4>{t(language, "dashboard.metrics.advanced.last30")}</h4>
                          <span className="summary-sub">{t(language, "dashboard.metrics.advanced.window")}</span>
                        </div>
                      </div>
                      <div className="metric-row">
                        <span className="metric-label">{t(language, "dashboard.metrics.attempts")}</span>
                        <span className="metric-value">{advancedData.attempts30}</span>
                        <span className={`metric-delta ${deltaClass(advancedData.attempts30, advancedData.attemptsPrev30)}`}>
                          {percentDelta(advancedData.attempts30, advancedData.attemptsPrev30)}
                        </span>
                      </div>
                      <div className="metric-row">
                        <span className="metric-label">{t(language, "dashboard.metrics.time")}</span>
                        <span className="metric-value">{formatSeconds(advancedData.time30)}</span>
                        <span className={`metric-delta ${deltaClass(advancedData.time30, advancedData.timePrev30)}`}>
                          {percentDelta(advancedData.time30, advancedData.timePrev30)}
                        </span>
                      </div>
                      <div className="metric-row">
                        <span className="metric-label">{t(language, "dashboard.metrics.sessions")}</span>
                        <span className="metric-value">{advancedData.sessions30}</span>
                        <span className={`metric-delta ${deltaClass(advancedData.sessions30, advancedData.sessionsPrev30)}`}>
                          {percentDelta(advancedData.sessions30, advancedData.sessionsPrev30)}
                        </span>
                      </div>
                    </div>
                    <div className="advanced-card">
                      <div className="advanced-card-title">{t(language, "dashboard.metrics.advanced.top_domains")}</div>
                      {advancedData.topDomains.length === 0 ? (
                        <EmptyState
                          className="metrics-empty small"
                          icon=""
                          title={t(language, "dashboard.metrics.pie.empty")}
                        />
                      ) : (
                        <ul className="advanced-list">
                          {advancedData.topDomains.map(([domain, seconds]) => (
                            <li key={domain}>
                              <span className="advanced-domain">{domain}</span>
                              <span className="advanced-value">{formatSeconds(seconds)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState
                  className="metrics-empty"
                  title={t(language, "dashboard.metrics.empty.title")}
                  description={t(language, "dashboard.metrics.empty.desc")}
                />
              )}
            </div>
          ) : null}

          <div className="actions" data-guide="metrics-actions">
            <button onClick={onExportMetrics}>{t(language, "dashboard.metrics.export")}</button>
            <button onClick={onResetMetrics}>{t(language, "dashboard.metrics.reset")}</button>
          </div>
        </div>
      )}
    </section>
  );
}
