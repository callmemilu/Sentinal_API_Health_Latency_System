'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface PingPoint {
  time: string;
  latency: number;
  status: number;
}

export default function LatencyChart({ data }: { data: PingPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-slate-500 font-mono">
        No ping telemetry recorded yet.
      </div>
    );
  }

  return (
    <div className="h-36 w-full pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            stroke="#64748b"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#64748b"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            unit="ms"
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload as PingPoint;
                return (
                  <div className="rounded-md border border-slate-800 bg-slate-900 p-2 shadow-xl text-xs">
                    <p className="font-semibold text-slate-200">{item.time}</p>
                    <p className="text-emerald-400 font-mono">{item.latency} ms</p>
                    <p className="text-slate-400">HTTP {item.status}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="latency"
            stroke="#10b981"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#latencyGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}