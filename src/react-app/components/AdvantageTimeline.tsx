import { useEffect, useMemo, useRef, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { MatchTimelineEvent } from '../lib/match-detail';
import { HeroMark } from './HeroMark';

type AdvantageTimelineProps = {
  networth: number[];
  experience: number[];
  durationSeconds: number | null;
  events: MatchTimelineEvent[];
};

type ChartTheme = {
  radiant: string;
  radiantRgb: string;
  dire: string;
  blue: string;
  muted: string;
  paper: string;
  grid: string;
};

type HoveredPoint = {
  index: number;
  left: number;
};

export function AdvantageTimeline({ networth, experience, durationSeconds, events }: AdvantageTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint | null>(null);
  const pointCount = Math.max(networth.length, experience.length);
  const duration = durationSeconds ?? Math.max(0, pointCount - 1) * 60;
  const timestamps = useMemo(() => buildTimestamps(pointCount, duration), [duration, pointCount]);
  const renderableEvents = useMemo(
    () => events.filter((event) => event.actor !== null && (event.type === 'tower' || event.target !== null)),
    [events],
  );
  const hoveredTime = hoveredPoint === null ? null : timestamps[hoveredPoint.index] ?? null;
  const eventWindowSeconds = Math.max(10, Math.round(duration / Math.max(1, pointCount - 1) / 2));
  const hoveredEvents = hoveredTime === null
    ? []
    : renderableEvents.filter((event) => Math.abs(event.time - hoveredTime) <= eventWindowSeconds).slice(0, 3);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || pointCount < 2) return;

    const theme = readChartTheme(container);
    const data = buildChartData(timestamps, networth, experience);
    const width = Math.max(280, Math.floor(container.clientWidth));
    const height = chartHeight(width);
    const chart = new uPlot(
      createChartOptions(width, height, duration, renderableEvents, theme, setHoveredPoint),
      data,
      container,
    );
    const resize = () => {
      const nextWidth = Math.max(280, Math.floor(container.clientWidth));
      chart.setSize({ width: nextWidth, height: chartHeight(nextWidth) });
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
  }, [duration, experience, networth, pointCount, renderableEvents, timestamps]);

  return (
    <div className="advantage-timeline">
      <div className="advantage-timeline__legend" aria-label="Chart legend">
        <span><i className="is-net" />Net worth</span>
        <span><i className="is-xp" />Experience</span>
        <span className="advantage-timeline__events-key">RADIANT ↑ · DIRE ↓ · ○ KILL · □ TOWER</span>
      </div>
      <div className="advantage-timeline__plot">
        <div className="advantage-timeline__canvas" ref={containerRef} role="group" aria-label="Team advantage timeline" />
        {hoveredTime !== null && hoveredPoint !== null ? (
          <div className="advantage-timeline__tooltip" role="status" style={{ left: `${Math.min(88, Math.max(12, hoveredPoint.left))}%` }}>
            <time>{formatDuration(hoveredTime)}</time>
            <span><i className="is-net" />Net worth <strong>{formatAdvantage(networth[hoveredPoint.index] ?? null)}</strong></span>
            <span><i className="is-xp" />Experience <strong>{formatAdvantage(experience[hoveredPoint.index] ?? null)}</strong></span>
            {hoveredEvents.length > 0 ? (
              <div className="advantage-timeline__events">
                {hoveredEvents.map((event) => <TimelineEventTooltip event={event} key={event.key} />)}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TimelineEventTooltip({ event }: { event: MatchTimelineEvent }) {
  const actorLabel = formatParticipant(event.actor);
  const targetLabel = formatParticipant(event.target);

  return (
    <div className={`advantage-timeline__event advantage-timeline__event--${event.type}`}>
      <time>{formatDuration(event.time)}</time>
      <div className="advantage-timeline__event-description">
        <HeroMark heroId={event.actor?.heroId ?? null} label={actorLabel} fallback="?" className="advantage-timeline__event-hero" />
        {event.type === 'kill' ? (
          <>
            <span className="advantage-timeline__event-action">KILLED</span>
            <HeroMark heroId={event.target?.heroId ?? null} label={targetLabel} fallback="?" className="advantage-timeline__event-hero" />
          </>
        ) : <span className="advantage-timeline__event-action">DESTROYED {event.targetIsRadiant ? 'RADIANT' : 'DIRE'} TOWER</span>}
      </div>
    </div>
  );
}

function createChartOptions(
  width: number,
  height: number,
  duration: number,
  events: MatchTimelineEvent[],
  theme: ChartTheme,
  setHoveredPoint: (point: HoveredPoint | null) => void,
): uPlot.Options {
  const eventMin = events.reduce((minimum, event) => Math.min(minimum, event.time), 0);
  const eventMax = events.reduce((maximum, event) => Math.max(maximum, event.time), duration);

  return {
    width,
    height,
    class: 'advantage-timeline__uplot',
    legend: { show: false },
    padding: [10, 10, 0, 0],
    series: [
      {},
      { label: 'Radiant net worth', scale: 'lead', stroke: theme.radiant, fill: `rgba(${theme.radiantRgb}, 0.14)`, width: 2 },
      { label: 'Dire net worth', scale: 'lead', stroke: theme.dire, fill: 'rgba(255, 54, 95, 0.12)', width: 2 },
      { label: 'Experience', scale: 'lead', stroke: theme.blue, width: 1.25, dash: [7, 5] },
    ],
    scales: {
      x: {
        time: false,
        range: () => [Math.min(0, eventMin), Math.max(duration, eventMax)],
      },
      lead: {
        range: (_chart, minimum, maximum) => {
          const absolute = Math.max(1, Math.abs(minimum), Math.abs(maximum));
          return [-absolute, absolute];
        },
      },
    },
    axes: [
      {
        stroke: theme.muted,
        grid: { show: true, stroke: theme.grid, width: 1 },
        ticks: { show: true, stroke: theme.grid, width: 1 },
        values: (_chart, splits) => splits.map(formatDuration),
        font: '12px monospace',
      },
      {
        scale: 'lead',
        side: 3,
        stroke: theme.muted,
        grid: { show: true, stroke: theme.grid, width: 1 },
        ticks: { show: false },
        values: (_chart, splits) => splits.map(formatSignedCompact),
        font: '12px monospace',
      },
    ],
    cursor: {
      x: true,
      y: false,
      drag: { x: true, y: false },
      points: { show: true, size: 7, width: 2 },
    },
    plugins: [timelineMarkerPlugin(events, theme)],
    hooks: {
      setCursor: [
        (chart) => {
          const index = chart.cursor.idx;
          const cursorLeft = chart.cursor.left;
          if (index === null || index === undefined || cursorLeft === undefined) {
            setHoveredPoint(null);
            return;
          }
          const plotLeft = chart.bbox.left / uPlot.pxRatio;
          setHoveredPoint({
            index,
            left: ((plotLeft + cursorLeft) / chart.width) * 100,
          });
        },
      ],
    },
  };
}

function timelineMarkerPlugin(events: MatchTimelineEvent[], theme: ChartTheme): uPlot.Plugin {
  return {
    hooks: {
      draw: (chart) => {
        const min = chart.scales.x.min ?? Number.NEGATIVE_INFINITY;
        const max = chart.scales.x.max ?? Number.POSITIVE_INFINITY;
        const size = 2 * uPlot.pxRatio;
        const { ctx } = chart;

        ctx.save();
        for (const event of events) {
          if (event.time < min || event.time > max) continue;
          const x = chart.valToPos(event.time, 'x', true);
          const y = event.isRadiant === false
            ? chart.bbox.top + chart.bbox.height - 9 * uPlot.pxRatio
            : chart.bbox.top + 9 * uPlot.pxRatio;
          ctx.fillStyle = eventColor(event, theme);
          if (event.type === 'kill') {
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillRect(x - size, y - size, size * 2, size * 2);
          }
        }
        ctx.restore();
      },
    },
  };
}

function buildChartData(timestamps: number[], networth: number[], experience: number[]): uPlot.AlignedData {
  const alignedNetworth = alignSeries(networth, timestamps.length);
  const alignedExperience = alignSeries(experience, timestamps.length);

  return [
    timestamps,
    alignedNetworth.map((value) => value !== null && value >= 0 ? value : null),
    alignedNetworth.map((value) => value !== null && value <= 0 ? value : null),
    alignedExperience,
  ];
}

function alignSeries(values: number[], length: number): Array<number | null> {
  return Array.from({ length }, (_, index) => values[index] ?? null);
}

function buildTimestamps(pointCount: number, duration: number): number[] {
  return Array.from({ length: pointCount }, (_, index) => pointCount === 1 ? 0 : (duration * index) / (pointCount - 1));
}

function readChartTheme(container: HTMLElement): ChartTheme {
  const style = getComputedStyle(container);
  return {
    radiant: style.getPropertyValue('--radiant').trim() || '#c6f24a',
    radiantRgb: style.getPropertyValue('--radiant-rgb').trim() || '198, 242, 74',
    dire: style.getPropertyValue('--signal-red').trim() || '#ff365f',
    blue: style.getPropertyValue('--signal-blue').trim() || '#49c7e5',
    muted: style.getPropertyValue('--muted').trim() || '#939c8c',
    paper: style.getPropertyValue('--paper').trim() || '#e0e6d0',
    grid: 'rgba(224, 230, 208, 0.11)',
  };
}

function chartHeight(width: number): number {
  return width < 620 ? 218 : 278;
}

function eventColor(event: MatchTimelineEvent, theme: ChartTheme): string {
  if (event.isRadiant === true) return theme.radiant;
  if (event.isRadiant === false) return theme.dire;
  return theme.paper;
}

function formatParticipant(participant: MatchTimelineEvent['actor']): string {
  if (participant?.name) return participant.name;
  if (participant?.heroId !== null && participant?.heroId !== undefined) return `Hero #${participant.heroId}`;
  return 'Unknown player';
}

function formatDuration(seconds: number): string {
  const absolute = Math.abs(Math.round(seconds));
  const minutes = Math.floor(absolute / 60).toString().padStart(2, '0');
  const remainder = (absolute % 60).toString().padStart(2, '0');
  return `${seconds < 0 ? '−' : ''}${minutes}:${remainder}`;
}

function formatAdvantage(value: number | null): string {
  if (value === null) return 'N/A';
  if (value === 0) return 'EVEN';
  return `${value > 0 ? 'RADIANT' : 'DIRE'} +${formatCompact(Math.abs(value))}`;
}

function formatSignedCompact(value: number): string {
  if (value === 0) return '0';
  return `${value > 0 ? '+' : '−'}${formatCompact(Math.abs(value))}`;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}
