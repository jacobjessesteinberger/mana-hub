import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3020',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: [
      'NEXT_PUBLIC_MANA_HUB_DEMO_MODE=true',
      'MANA_HUB_DEMO_MODE=true',
      'NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY=demo-anon-key',
      'SUPABASE_SERVICE_ROLE_KEY=demo-service-role-key',
      'npm run dev -- -H 127.0.0.1 -p 3020',
    ].join(' '),
    url: 'http://127.0.0.1:3020/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
