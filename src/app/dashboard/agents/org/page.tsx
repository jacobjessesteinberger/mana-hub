'use client'

import { useEffect, useState, useCallback } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import AgentAvatar from '@/components/ui/AgentAvatar'
import { AGENT_MAP, type AgentMeta } from '@/lib/agents-meta'
import { Users, Briefcase, Shield } from 'lucide-react'

interface Profile {
  agent_name: string
  parent_agent: string | null
  title: string
  job_description: string | null
  department: string | null
  can_delegate_to: string[]
  hire_date: string
  meta: AgentMeta | null
}

function OrgNode({ profile, childProfiles, allProfiles }: { profile: Profile; childProfiles?: Profile[]; allProfiles: Profile[] }) {
  const agentMeta = profile.meta || AGENT_MAP[profile.agent_name]
  const isRoot = !profile.parent_agent

  return (
    <div className="flex flex-col items-center">
      <div
        className={`
          relative rounded-2xl border p-5 min-w-[200px] max-w-[260px] text-center transition-all
          hover:shadow-lg hover:-translate-y-0.5
          ${isRoot
            ? 'bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-500/10 dark:to-violet-500/10 border-purple-200 dark:border-purple-500/20 shadow-md'
            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm'
          }
        `}
      >
        <div className="flex flex-col items-center gap-3">
          {agentMeta ? (
            <AgentAvatar agent={agentMeta} size="lg" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-lg">
              {profile.agent_name[0].toUpperCase()}
            </div>
          )}

          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              {agentMeta?.label || profile.agent_name.toUpperCase()}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {profile.title}
            </p>
          </div>

          {profile.department && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{
                backgroundColor: (agentMeta?.color || '#8B5CF6') + '15',
                color: agentMeta?.color || '#8B5CF6',
              }}
            >
              <Briefcase className="w-3 h-3" />
              {profile.department}
            </span>
          )}

          {profile.job_description && (
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed mt-1">
              {profile.job_description}
            </p>
          )}

          {profile.can_delegate_to.length > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <Shield className="w-3 h-3 text-zinc-400" />
              <span className="text-[10px] text-zinc-400">
                delegiert an {profile.can_delegate_to.map(n => n.toUpperCase()).join(', ')}
              </span>
            </div>
          )}
        </div>
      </div>

      {childProfiles && childProfiles.length > 0 && (
        <>
          <div className="w-px h-8 bg-zinc-300 dark:bg-zinc-600" />
          <div className="relative flex gap-6">
            {childProfiles.length > 1 && (
              <div
                className="absolute top-0 h-px bg-zinc-300 dark:bg-zinc-600"
                style={{
                  left: `calc(50% - ${(childProfiles.length - 1) * 50}%)`,
                  right: `calc(50% - ${(childProfiles.length - 1) * 50}%)`,
                }}
              />
            )}
            {childProfiles.map(child => {
              const grandchildren = allProfiles.filter(p => p.parent_agent === child.agent_name)
              return (
                <div key={child.agent_name} className="flex flex-col items-center">
                  <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-600" />
                  <OrgNode profile={child} childProfiles={grandchildren} allProfiles={allProfiles} />
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default function OrgChartPage() {
  const [data, setData] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await authFetch('/api/agents/profiles')
      const json = await res.json()
      setData(json.profiles || [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const root = data.find(p => !p.parent_agent)
  const directReports = data.filter(p => p.parent_agent === root?.agent_name)

  return (
    <div className="flex-1 overflow-auto p-4 lg:p-8">
      <div className="mb-6 lg:mb-8">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-500" />
          Org Chart
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Hierarchie und Zuständigkeiten der Agents
        </p>
      </div>

      {root ? (
        <div className="flex justify-center">
          <OrgNode profile={root} childProfiles={directReports} allProfiles={data} />
        </div>
      ) : (
        <div className="text-center py-20">
          <Users className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Keine Agent-Profile gefunden.</p>
          <p className="text-xs text-zinc-400 mt-1">
            Führe die SQL-Migration <code>009_agent_profiles.sql</code> aus.
          </p>
        </div>
      )}

      {/* Stats */}
      {data.length > 0 && (
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 text-center">
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">{data.length}</p>
            <p className="text-xs text-zinc-500 mt-1">Agents</p>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 text-center">
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">
              {new Set(data.map(p => p.department).filter(Boolean)).size}
            </p>
            <p className="text-xs text-zinc-500 mt-1">Departments</p>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 text-center">
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">
              {data.filter(p => !p.parent_agent).length}
            </p>
            <p className="text-xs text-zinc-500 mt-1">Leadership</p>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 text-center">
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">
              {data.filter(p => p.can_delegate_to.length > 0).length}
            </p>
            <p className="text-xs text-zinc-500 mt-1">Delegierer</p>
          </div>
        </div>
      )}
    </div>
  )
}
