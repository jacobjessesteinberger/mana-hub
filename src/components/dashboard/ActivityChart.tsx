'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

interface Props {
  data: { d: string; r: number }[]
}

export default function ActivityChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="d" tick={{ fontSize: 11, fill: '#999' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#999' }} tickLine={false} axisLine={false} width={20} />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: '1px solid #e5e5e5',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            fontSize: 12,
          }}
        />
        <Bar dataKey="r" fill="#2A8544" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
