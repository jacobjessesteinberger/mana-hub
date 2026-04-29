import { expect, test } from '@playwright/test'

const pages = [
  { path: '/login', title: /Mana Hub Starter|Open Local Demo/ },
  { path: '/dashboard/agents', title: /Mana Hub|Agents|Dashboard/ },
  { path: '/dashboard/agents/issues', title: /Tasks|Task/ },
  { path: '/dashboard/agents/projects', title: /Workspaces|Workspace/ },
  { path: '/dashboard/agents/goals', title: /Outcomes|Goals|Ziele/ },
  { path: '/dashboard/agents/briefings', title: /Briefings|Briefing/ },
  { path: '/dashboard/agents/approvals', title: /Risk Approval|Approval/ },
  { path: '/dashboard/agents/routines', title: /Jobs & Skills|Automation|Skills/ },
  { path: '/dashboard/agents/knowledge', title: /Knowledge Base|Demo Knowledge/ },
  { path: '/dashboard/agents/skills', title: /Skill Hub|Skill/ },
  { path: '/dashboard/agents/health', title: /Health|Agent Health/ },
  { path: '/dashboard/agents/org', title: /Org|Chart/ },
  { path: '/dashboard/agents/settings', title: /Settings|Configuration/ },
  { path: '/dashboard/agents/setup', title: /Setup|Onboarding/ },
]

test.describe('Mana Hub Starter smoke test', () => {
  for (const pageInfo of pages) {
    test(`${pageInfo.path} loads without crashing`, async ({ page }) => {
      const consoleErrors: string[] = []
      page.on('console', message => {
        if (message.type() === 'error') consoleErrors.push(message.text())
      })
      page.on('pageerror', error => {
        consoleErrors.push(error.message)
      })

      await page.goto(pageInfo.path)
      await expect(page.locator('body')).toContainText(pageInfo.title)
      await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error')
      await expect(page.locator('body')).not.toContainText('Application error')
      await expect(page.locator('body')).not.toContainText('TypeError:')
      expect(consoleErrors).toEqual([])
    })
  }
})
