'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from 'recharts'

const STATUS_COLORS: Record<string, string> = {
  done: '#10b981', in_progress: '#3b82f6', in_review: '#eab308', todo: '#71717a', blocked: '#ef4444',
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#71717a',
}

const tooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: '12px',
  fontSize: '12px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
}

interface Stats {
  runActivity: { day: string; runs: number }[]
  issuesByPriority: { priority: string; count: number }[]
  issuesByStatus: { status: string; count: number }[]
  successRate: { day: string; succeeded: number; failed: number }[]
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 p-5">
      <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">{title}</h3>
      <div className="h-40">{children}</div>
    </div>
  )
}

interface Props {
  stats: Stats | null
  color: string
}

export default function AgentDetailCharts({ stats, color }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ChartCard title="Run Activity (14 Days)">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats?.runActivity || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#999' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#999' }} tickLine={false} axisLine={false} width={20} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="runs" fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Tasks by Priority">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats?.issuesByPriority || []} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#999' }} tickLine={false} axisLine={false} />
            <YAxis dataKey="priority" type="category" tick={{ fontSize: 10, fill: '#999' }} tickLine={false} axisLine={false} width={50} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {(stats?.issuesByPriority || []).map((entry, i) => (
                <Cell key={i} fill={PRIORITY_COLORS[entry.priority] || '#71717a'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Tasks by Status">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats?.issuesByStatus || []} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#999' }} tickLine={false} axisLine={false} />
            <YAxis dataKey="status" type="category" tick={{ fontSize: 10, fill: '#999' }} tickLine={false} axisLine={false} width={70} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {(stats?.issuesByStatus || []).map((entry, i) => (
                <Cell key={i} fill={STATUS_COLORS[entry.status] || '#71717a'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Success Rate (14 Days)">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats?.successRate || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#999' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#999' }} tickLine={false} axisLine={false} width={20} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="succeeded" stackId="a" fill="#10b981" />
            <Bar dataKey="failed" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
