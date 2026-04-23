import React from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency } from '../../shared/utils'
import type { WeeklyCashflowPoint } from './weeklyCashflow'

const CustomTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card px-3 py-2 text-xs">
      <div style={{ color: 'var(--text-muted)' }}>{label}</div>
      {payload.map((item: any) => (
        <div key={item.dataKey} className="font-bold" style={{ color: item.color }}>
          {item.name}: {formatCurrency(item.value)}
        </div>
      ))}
    </div>
  )
}

export default function SpendingOverviewChart({ data }: { data: WeeklyCashflowPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="creditGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="debitGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="d" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
        <YAxis hide />
        <Tooltip content={<CustomTip />} />
        <Area
          type="monotone"
          dataKey="credit"
          name="Credit"
          stroke="#22c55e"
          strokeWidth={2}
          fill="url(#creditGradient)"
          dot={false}
          activeDot={{ r: 4, fill: '#22c55e' }}
        />
        <Area
          type="monotone"
          dataKey="debit"
          name="Debit"
          stroke="#ef4444"
          strokeWidth={2}
          fill="url(#debitGradient)"
          dot={false}
          activeDot={{ r: 4, fill: '#ef4444' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
