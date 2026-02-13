import { useEffect, useRef, type RefObject } from "react";
import type { Chart, ChartOptions } from "chart.js";
import type { ChartSeries, PieSeries } from "../types";

type UseMetricsChartsParams = {
  chartSeries: ChartSeries | null;
  pieSeries: PieSeries | null;
  enabled: boolean;
  metricsTab: "summary" | "charts" | "table" | "advanced";
  attemptsCanvasRef: RefObject<HTMLCanvasElement>;
  timeCanvasRef: RefObject<HTMLCanvasElement>;
  pieCanvasRef: RefObject<HTMLCanvasElement>;
  formatSeconds: (value: number) => string;
};

export function useMetricsCharts({
  chartSeries,
  pieSeries,
  enabled,
  metricsTab,
  attemptsCanvasRef,
  timeCanvasRef,
  pieCanvasRef,
  formatSeconds
}: UseMetricsChartsParams) {
  const attemptsChartRef = useRef<Chart | null>(null);
  const timeChartRef = useRef<Chart | null>(null);
  const pieChartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const destroyCharts = () => {
      attemptsChartRef.current?.destroy();
      attemptsChartRef.current = null;
      timeChartRef.current?.destroy();
      timeChartRef.current = null;
      pieChartRef.current?.destroy();
      pieChartRef.current = null;
    };

    if (!enabled || metricsTab !== "charts" || !chartSeries) {
      destroyCharts();
      return () => undefined;
    }

    let cancelled = false;

    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 800,
        easing: "easeOutQuart"
      },
      transitions: {
        active: {
          animation: { duration: 200 }
        },
        resize: {
          animation: { duration: 300 }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items: { label?: string }[]) => (items[0]?.label ? `Fecha: ${items[0].label}` : "")
          }
        }
      },
      scales: {
        x: { ticks: { autoSkip: true, maxTicksLimit: 7 } },
        y: { beginAtZero: true }
      }
    } satisfies ChartOptions<"bar">;

    const createCharts = async () => {
      const { default: ChartCtor } = await import("chart.js/auto");
      if (cancelled) {
        return;
      }

      if (attemptsCanvasRef.current) {
        attemptsChartRef.current?.destroy();
        attemptsChartRef.current = new ChartCtor(attemptsCanvasRef.current, {
          type: "bar",
          data: {
            labels: chartSeries.labels,
            datasets: [
              {
                data: chartSeries.attempts,
                backgroundColor: "rgba(239, 68, 68, 0.35)",
                borderColor: "rgba(239, 68, 68, 0.9)",
                borderWidth: 1,
                borderRadius: 8
              }
            ]
          },
          options: {
            ...baseOptions,
            scales: {
              ...baseOptions.scales,
              y: {
                ...(baseOptions.scales?.y || {}),
                ticks: {
                  precision: 0,
                  stepSize: 1
                }
              }
            },
            plugins: {
              ...baseOptions.plugins,
              tooltip: {
                callbacks: {
                  label: (ctx) => `Intentos: ${ctx.parsed.y ?? 0}`
                }
              }
            }
          }
        });
      }

      if (timeCanvasRef.current) {
        timeChartRef.current?.destroy();
        timeChartRef.current = new ChartCtor(timeCanvasRef.current, {
          type: "bar",
          data: {
            labels: chartSeries.labels,
            datasets: [
              {
                data: chartSeries.times,
                backgroundColor: "rgba(59, 130, 246, 0.35)",
                borderColor: "rgba(59, 130, 246, 0.9)",
                borderWidth: 1,
                borderRadius: 8
              }
            ]
          },
          options: {
            ...baseOptions,
            plugins: {
              ...baseOptions.plugins,
              tooltip: {
                callbacks: {
                  label: (ctx) => `Tiempo: ${formatSeconds(ctx.parsed.y ?? 0)}`
                }
              }
            }
          }
        });
      }

      if (pieCanvasRef.current && pieSeries) {
        pieChartRef.current?.destroy();
        pieChartRef.current = new ChartCtor(pieCanvasRef.current, {
          type: "pie",
          data: {
            labels: pieSeries.labels,
            datasets: [
              {
                data: pieSeries.values,
                backgroundColor: [
                  "rgba(59, 130, 246, 0.6)",
                  "rgba(16, 185, 129, 0.6)",
                  "rgba(249, 115, 22, 0.6)",
                  "rgba(168, 85, 247, 0.6)",
                  "rgba(234, 179, 8, 0.6)",
                  "rgba(148, 163, 184, 0.6)"
                ],
                borderColor: "rgba(255, 255, 255, 0.9)",
                borderWidth: 1
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
              duration: 900,
              easing: "easeOutQuart"
            },
            transitions: {
              active: {
                animation: { duration: 200 }
              },
              resize: {
                animation: { duration: 300 }
              }
            },
            plugins: {
              legend: { display: true, position: "bottom" }
            }
          } satisfies ChartOptions<"pie">
        });
      } else if (!pieSeries) {
        pieChartRef.current?.destroy();
        pieChartRef.current = null;
      }
    };

    void createCharts();

    return () => {
      cancelled = true;
      destroyCharts();
    };
  }, [chartSeries, pieSeries, enabled, metricsTab, attemptsCanvasRef, timeCanvasRef, pieCanvasRef, formatSeconds]);
}
