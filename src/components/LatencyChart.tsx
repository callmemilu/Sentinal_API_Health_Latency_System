"use client";

import React, { useId } from "react";
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
  isUp?: boolean;
}

interface CustomDotProps {
  cx?: number;
  cy?: number;
  index?: number;
}

export default function LatencyChart({
  data,
  activeIndex,
  onHoverIndex,
  isUp = true,
}: LatencyChartProps) {
  const uniqueId = useId().replace(/:/g, "");
  const gradientId = `latencyGradient-${uniqueId}-${isUp ? "healthy" : "degraded"}`;

  if (!data || data.length === 0) {
    return (
      <div className="h-32 w-full flex items-center justify-center text-xs font-mono text-slate-500">
        Awaiting telemetry samples...
      </div>
    );
  }

  // Theme palettes based on operational status
  const strokeColor = isUp ? "#10b981" : "#f43f5e";
  const dotFillColor = isUp ? "#34d399" : "#fb7185";

  return (
    <div className="h-36 w-full overflow-visible">
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
          margin={{ top: 16, right: 10, left: -25, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={strokeColor} stopOpacity={0.35} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            stroke="#475569"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          {/* Dynamic 25% headroom ensures 1600ms+ spikes never clip outside the chart top */}
          <YAxis
            stroke="#475569"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            unit="ms"
            domain={[0, (dataMax: number) => Math.max(Math.ceil(dataMax * 1.25), 50)]}
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
                const pointIsUp =
                  item.isUp !== undefined
                    ? item.isUp
                    : item.status >= 200 && item.status < 400;

                return (
                  <div
                    className={`rounded-lg border px-2.5 py-1.5 shadow-xl text-xs font-mono backdrop-blur-md ${
                      pointIsUp
                        ? "border-slate-700 bg-slate-900/95"
                        : "border-rose-700/80 bg-rose-950/95 text-rose-100"
                    }`}
                  >
                    <p className="text-slate-400">{item.time}</p>
                    <p
                      className={`font-semibold ${
                        pointIsUp ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      Latency: {item.latency} ms
                    </p>
                    <p className={pointIsUp ? "text-slate-300" : "text-rose-200"}>
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
            stroke={strokeColor}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#${gradientId})`}
            dot={(props: CustomDotProps) => {
              const isSelected = props.index === activeIndex;
              if (!isSelected || props.cx === undefined || props.cy === undefined) {
                return (
                  <circle
                    key={`dot-${props.index}`}
                    cx={props.cx}
                    cy={props.cy}
                    r={0}
                    fill="none"
                  />
                );
              }

              // Clamp coordinate within top margin boundary
              const safeCy = Math.max(12, props.cy);

              return (
                <g key={`active-dot-${props.index}`}>
                  <circle
                    cx={props.cx}
                    cy={safeCy}
                    r={9}
                    fill={strokeColor}
                    fillOpacity={0.25}
                    className="animate-ping origin-center"
                  />
                  <circle
                    cx={props.cx}
                    cy={safeCy}
                    r={4}
                    fill={dotFillColor}
                    stroke="#ffffff"
                    strokeWidth={1.8}
                  />
                </g>
              );
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}