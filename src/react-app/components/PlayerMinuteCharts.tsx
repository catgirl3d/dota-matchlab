import { useEffect, useMemo, useRef, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { MatchDetailPlayer } from '../lib/match-detail';

type PlayerMinuteChartsProps = {
  durationSeconds: number | null;
  levelCapReached: boolean;
  series: MatchDetailPlayer['minuteSeries'];
};

type SeriesKey = keyof Pick<MatchDetailPlayer['minuteSeries'], 'gold' | 'experience' | 'netWorth' | 'heroDamage'>;

type MetricConfig = {
  key: SeriesKey;
  label: string;
  colorToken: string;
  fallbackColor: string;
};

type HoveredPoint = {
  index: number;
  left: number;
};

const METRICS: MetricConfig[] = [
  { key: 'gold', label: 'Gold', colorToken: '--acid', fallbackColor: '#c6f24a' },
  { key: 'experience', label: 'XP', colorToken: '--signal-blue', fallbackColor: '#49c7e5' },
  { key: 'netWorth', label: 'Net worth', colorToken: '--signal-violet', fallbackColor: '#b57aff' },
  { key: 'heroDamage', label: 'Hero damage', colorToken: '--signal-red', fallbackColor: '#ff365f' },
];

export function PlayerMinuteCharts({ durationSeconds, levelCapReached, series }: PlayerMinuteChartsProps) {
  return (
    <div className="player-minute-charts" aria-label="Per-minute player performance charts">
      {METRICS.map((metric, index) => (
        <PlayerMinuteChart
          config={metric}
          durationSeconds={durationSeconds}
          key={metric.key}
          levelCapReached={metric.key === 'experience' && levelCapReached}
          showXAxis={index === METRICS.length - 1}
          values={series[metric.key]}
        />
      ))}
    </div>
  );
}

function PlayerMinuteChart({
  config,
  durationSeconds,
  levelCapReached,
  showXAxis,
  values,
}: {
  config: MetricConfig;
  durationSeconds: number | null;
  levelCapReached: boolean;
  showXAxis: boolean;
  values: number[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint | null>(null);
  const duration = durationSeconds ?? Math.max(0, values.length - 1) * 60;
  const timestamps = useMemo(() => buildTimestamps(values.length, duration), [duration, values.length]);
  const hoveredTime = hoveredPoint === null ? null : timestamps[hoveredPoint.index] ?? null;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || values.length < 2) return;

    const style = getComputedStyle(container);
    const color = style.getPropertyValue(config.colorToken).trim() || config.fallbackColor;
    const muted = style.getPropertyValue('--muted').trim() || '#939c8c';
    const paper = style.getPropertyValue('--paper').trim() || '#e0e6d0';
    const grid = 'rgba(224, 230, 208, 0.1)';
    const width = Math.max(220, Math.floor(container.clientWidth));
    const height = chartHeight(showXAxis);
    const chart = new uPlot(
      {
        width,
        height,
        class: 'player-minute-chart__uplot',
        legend: { show: false },
        padding: [8, 8, 0, 0],
        series: [
          {},
          { label: config.label, scale: 'value', stroke: color, width: 1.75, points: { show: false } },
        ],
        scales: {
          x: { time: false, range: () => [0, duration] },
          value: {
            range: (_chart, minimum, maximum) => {
              const lower = Math.min(0, minimum);
              const upper = Math.max(1, maximum);
              const padding = Math.max(1, (upper - lower) * 0.08);
              return [lower, upper + padding];
            },
          },
        },
        axes: [
          {
            show: showXAxis,
            stroke: muted,
            grid: { show: showXAxis, stroke: grid, width: 1 },
            ticks: { show: showXAxis, stroke: grid, width: 1 },
            values: (_chart, splits) => splits.map(formatDuration),
            font: '11px monospace',
          },
          {
            scale: 'value',
            side: 3,
            stroke: muted,
            grid: { show: true, stroke: grid, width: 1 },
            ticks: { show: false },
            values: (_chart, splits) => splits.map(formatCompact),
            font: '11px monospace',
          },
        ],
        cursor: {
          x: true,
          y: false,
          drag: { x: true, y: false },
          points: { show: true, size: 6, width: 2, stroke: paper, fill: color },
        },
        hooks: {
          setCursor: [
            (instance) => {
              const index = instance.cursor.idx;
              const cursorLeft = instance.cursor.left;
              if (index === null || index === undefined || cursorLeft === undefined) {
                setHoveredPoint(null);
                return;
              }
              const plotLeft = instance.bbox.left / uPlot.pxRatio;
              setHoveredPoint({ index, left: ((plotLeft + cursorLeft) / instance.width) * 100 });
            },
          ],
        },
      },
      [timestamps, values],
      container,
    );
    const resize = () => {
      const nextWidth = Math.max(220, Math.floor(container.clientWidth));
      chart.setSize({ width: nextWidth, height: chartHeight(showXAxis) });
    };
    const clearHover = () => setHoveredPoint(null);
    let observer: ResizeObserver | null = null;

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(resize);
      observer.observe(container);
    } else {
      window.addEventListener('resize', resize);
    }
    chart.over.addEventListener('mouseleave', clearHover);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      chart.over.removeEventListener('mouseleave', clearHover);
      chart.destroy();
    };
  }, [config, duration, showXAxis, timestamps, values]);

  return (
    <section className="player-minute-chart">
      <div className="player-minute-chart__header">
        <div className="player-minute-chart__header-label">
          <span>{config.label}</span>
          {levelCapReached ? <span className="player-minute-chart__level-cap">LEVEL CAP</span> : null}
        </div>
        <strong>{formatCompact(values.at(-1) ?? 0)}</strong>
      </div>
      {values.length < 2 ? <span className="player-minute-chart__empty">No timeline</span> : (
        <div className="player-minute-chart__plot">
          <div className="player-minute-chart__canvas" ref={containerRef} role="group" aria-label={`${config.label} per-minute chart`} />
          {hoveredTime !== null && hoveredPoint !== null ? (
            <div className="player-minute-chart__tooltip" role="status" style={{ left: `${Math.min(88, Math.max(12, hoveredPoint.left))}%` }}>
              <time>{formatDuration(hoveredTime)}</time>
              <strong>{formatCompact(values[hoveredPoint.index] ?? 0)}</strong>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function buildTimestamps(pointCount: number, duration: number): number[] {
  return Array.from({ length: pointCount }, (_, index) => pointCount === 1 ? 0 : (duration * index) / (pointCount - 1));
}

function chartHeight(showXAxis: boolean): number {
  return showXAxis ? 92 : 70;
}

function formatDuration(seconds: number): string {
  const absolute = Math.abs(Math.round(seconds));
  const minutes = Math.floor(absolute / 60).toString().padStart(2, '0');
  const remainder = (absolute % 60).toString().padStart(2, '0');
  return `${seconds < 0 ? '−' : ''}${minutes}:${remainder}`;
}

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}
