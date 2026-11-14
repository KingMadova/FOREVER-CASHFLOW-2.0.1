import React from 'react';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  segments: DonutSegment[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  segments,
  centerLabel,
  centerValue,
  size = 150,
}) => {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const strokeWidth = 14;
  const radius = size / 2 - strokeWidth / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const visible = segments.filter((s) => s.value > 0);

  let offset = 0;
  const arcs = visible.map((seg, i) => {
    const dash = (seg.value / total) * circumference;
    const el = (
      <circle
        key={i}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={seg.color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeDashoffset={-offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    );
    offset += dash;
    return el;
  });

  return (
    <div className="donut-chart" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--fcf-border)"
          strokeWidth={strokeWidth}
          opacity="0.35"
        />
        {total > 0 && arcs}
      </svg>
      <div className="donut-chart-center">
        {centerLabel && <p className="donut-chart-label">{centerLabel}</p>}
        {centerValue && <p className="donut-chart-value">{centerValue}</p>}
      </div>
    </div>
  );
};

export interface DonutLegendProps {
  segments: DonutSegment[];
  formatValue?: (n: number) => string;
}

export const DonutLegend: React.FC<DonutLegendProps> = ({
  segments,
  formatValue = (n) => String(Math.round(n)),
}) => (
  <ul className="donut-legend">
    {segments.map((seg, i) => (
      <li key={i} className="donut-legend-item">
        <span className="donut-legend-dot" style={{ background: seg.color }} />
        <span className="donut-legend-label">{seg.label}</span>
        <span className="donut-legend-value">{formatValue(seg.value)}</span>
      </li>
    ))}
  </ul>
);

export default DonutChart;