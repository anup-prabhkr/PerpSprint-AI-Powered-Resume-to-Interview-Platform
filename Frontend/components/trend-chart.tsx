interface TrendChartProps {
  values: number[];
}

const WIDTH = 320;
const HEIGHT = 140;
const PADDING = 12;

export function TrendChart({ values }: TrendChartProps) {
  if (values.length < 2) {
    return (
      <p className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
        Run another analysis to see how your score changes over time.
      </p>
    );
  }

  const innerWidth = WIDTH - PADDING * 2;
  const innerHeight = HEIGHT - PADDING * 2;
  const points = values.map((value, index) => ({
    x: PADDING + (index / (values.length - 1)) * innerWidth,
    y: PADDING + (1 - value / 100) * innerHeight,
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `${points[0].x},${HEIGHT - PADDING} ${line} ${points[points.length - 1].x},${HEIGHT - PADDING}`;
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full" role="img" aria-label="Score trend">
      <defs>
        <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2D6BFF" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#2D6BFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#trend-fill)" />
      <polyline
        points={line}
        fill="none"
        stroke="#1F55E6"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r={index === points.length - 1 ? 5 : 3}
          fill={index === points.length - 1 ? '#1F55E6' : '#FFFFFF'}
          stroke="#1F55E6"
          strokeWidth="2"
        />
      ))}
      <text x={last.x} y={last.y - 12} textAnchor="end" className="fill-foreground text-[11px] font-semibold">
        {values[values.length - 1]}
      </text>
    </svg>
  );
}
