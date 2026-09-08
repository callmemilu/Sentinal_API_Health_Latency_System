"use client";

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface LatencyDataPoint {
  id?: string;
  time: string;
  latency: number;
  status: number;
  isUp?: boolean;
}

interface LatencyChartProps {
  data: LatencyDataPoint[];
  activeIndex?: number | null;
  onHoverIndex?: (index: number | null) => void;
}

interface CustomDotProps {
  cx?: number;
  cy?: number;
  index?: number;
  key?: React.Key | null;
}

export default function LatencyChart({
  data,
  activeIndex,
  onHoverIndex,
}: LatencyChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-32 w-full flex items-center justify-center text-xs font-mono text-slate-500">
        Awaiting telemetry samples...
      </div>
    );
  }

  return (
    <div className="h-36 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          onMouseMove={(state) => {
            if (state && state.activeTooltipIndex !== undefined && onHoverIndex) {
              const rawIndex = state.activeTooltipIndex;
              const numericIndex =
                typeof rawIndex === "number" ? rawIndex : Number(rawIndex);

              onHoverIndex(Number.isNaN(numericIndex) ? null : numericIndex);
            }
          }}
          onMouseLeave={() => {
            if (onHoverIndex) onHoverIndex(null);
          }}
          margin={{ top: 8, right: 10, left: -25, bottom: 0 }}
        >
          <defs>
            <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            stroke="#475569"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#475569"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            unit="ms"
          />
          <Tooltip
            defaultIndex={
              activeIndex !== null && activeIndex !== undefined
                ? activeIndex
                : undefined
            }
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload as LatencyDataPoint;
                return (
                  <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-2.5 py-1.5 shadow-xl text-xs font-mono">
                    <p className="text-slate-400">{item.time}</p>
                    <p className="font-semibold text-emerald-400">
                      Latency: {item.latency} ms
                    </p>
                    <p className="text-slate-300">
                      Status: {item.status ? `HTTP ${item.status}` : "Timeout / Abort"}
                    </p>
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
            dot={(props: CustomDotProps) => {
              const isSelected = props.index === activeIndex;
              if (!isSelected) {
                return (
                  <circle
                    key={props.index}
                    cx={props.cx}
                    cy={props.cy}
                    r={0}
                    fill="none"
                  />
                );
              }
              return (
                <circle
                  key={props.index}
                  cx={props.cx}
                  cy={props.cy}
                  r={5}
                  fill="#34d399"
                  stroke="#ffffff"
                  strokeWidth={2}
                  className="animate-ping origin-center"
                />
              );
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}