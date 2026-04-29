import { z } from 'zod'
import { NextResponse } from 'next/server'
import { VALID_AGENT_NAMES } from './agents-meta'

const agentNameEnum = z.enum(VALID_AGENT_NAMES)

// --- Issues ---

const planningContextSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(5000),
  })).max(30),
  model: z.enum(['sonnet', 'opus']),
  finalized_at: z.string().optional(),
}).optional().nullable()

export const createIssueSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  status: z.enum(['todo', 'in_progress', 'in_review', 'blocked', 'done']).default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  agent_name: agentNameEnum.optional(),
  reviewer_agent: agentNameEnum.nullable().optional(),
  project: z.string().max(100).optional(),
  labels: z.array(z.string().max(50)).max(20).default([]),
  goal_id: z.string().uuid().optional(),
  due_at: z.string().datetime().nullable().optional(),
  acceptance_criteria: z.string().max(20000).nullable().optional(),
  next_action: z.string().max(5000).nullable().optional(),
  blocked_reason: z.string().max(5000).nullable().optional(),
  source_type: z.enum(['manual', 'chat', 'briefing', 'automation']).nullable().optional(),
  source_id: z.string().max(200).nullable().optional(),
  planning_context: planningContextSchema,
})

export const updateIssueSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  status: z.enum(['todo', 'in_progress', 'in_review', 'blocked', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  agent_name: agentNameEnum.nullable().optional(),
  project: z.string().max(100).nullable().optional(),
  labels: z.array(z.string().max(50)).max(20).optional(),
  goal_id: z.string().uuid().nullable().optional(),
  due_at: z.string().datetime().nullable().optional(),
  acceptance_criteria: z.string().max(20000).nullable().optional(),
  next_action: z.string().max(5000).nullable().optional(),
  blocked_reason: z.string().max(5000).nullable().optional(),
  source_type: z.enum(['manual', 'chat', 'briefing', 'automation']).nullable().optional(),
  source_id: z.string().max(200).nullable().optional(),
  result: z.string().max(50000).optional(),
  reviewer_agent: agentNameEnum.nullable().optional(),
  archived: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' })

// --- Comments ---

export const createCommentSchema = z.object({
  content: z.string().min(1).max(10000),
  author: z.string().min(1).max(100).optional(),
})

// --- Runs ---

export const createRunSchema = z.object({
  agent_name: agentNameEnum,
})

export const updateRunSchema = z.object({
  run_id: z.string().uuid(),
  status: z.enum(['running', 'succeeded', 'failed', 'stopped']),
  output: z.string().max(50000).optional(),
  tokens_used: z.number().int().nonnegative().optional(),
})

// --- Goals ---

export const createGoalSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  level: z.enum(['company', 'project', 'team', 'agent', 'task']),
  parent_id: z.string().uuid().optional(),
  project: z.string().max(100).optional(),
  project_id: z.string().uuid().nullable().optional(),
  agent_name: agentNameEnum.optional(),
  target_value: z.number().nullable().optional(),
  current_value: z.number().nullable().optional(),
  unit: z.string().max(40).nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
  tracking_source: z.enum(['live_api', 'agent_report', 'manual', 'not_connected']).default('not_connected'),
  confidence: z.enum(['high', 'medium', 'low']).default('low'),
  source_label: z.string().max(120).nullable().optional(),
  last_checked_at: z.string().datetime().nullable().optional(),
})

export const updateGoalSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  level: z.enum(['company', 'project', 'team', 'agent', 'task']).optional(),
  parent_id: z.string().uuid().nullable().optional(),
  project: z.string().max(100).nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  agent_name: agentNameEnum.nullable().optional(),
  status: z.enum(['active', 'completed', 'paused']).optional(),
  progress: z.number().min(0).max(100).optional(),
  target_value: z.number().nullable().optional(),
  current_value: z.number().nullable().optional(),
  unit: z.string().max(40).nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
  tracking_source: z.enum(['live_api', 'agent_report', 'manual', 'not_connected']).optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
  source_label: z.string().max(120).nullable().optional(),
  last_checked_at: z.string().datetime().nullable().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' })

// --- Messages ---

export const createMessageSchema = z.object({
  agent_name: agentNameEnum,
  content: z.string().min(1).max(50000),
  ticket_id: z.string().uuid().optional(),
  reply_to_id: z.string().uuid().optional(),
  metadata: z.object({
    attachments: z.array(z.object({
      name: z.string(),
      url: z.string().url(),
      type: z.string(),
      size: z.number(),
    })).optional(),
  }).optional(),
})

// --- Trigger ---

export const triggerSchema = z.object({
  agent_id: agentNameEnum,
  job_id: z.string().min(1).max(200),
})

// --- Knowledge ---

export const updateKnowledgeSchema = z.object({
  content: z.string().max(500_000),
})

export const fileIdSchema = z.string().regex(/^[a-f0-9]{12}$/)

// --- Query param schemas ---

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

// --- Helper ---

export function parseBody<T>(schema: z.ZodType<T>, data: unknown):
  { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues.map(i => ({
      path: i.path.join('.'),
      message: i.message,
    }))
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Validation failed', issues },
        { status: 400 }
      ),
    }
  }
  return { success: true, data: result.data }
}
