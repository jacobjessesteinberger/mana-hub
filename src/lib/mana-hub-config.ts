export interface ManaHubHostConfig {
  shell: {
    showSearch: boolean
    showThemeToggle: boolean
    showEnvironmentBadge: boolean
    showSetupPage: boolean
    showUserAvatar: boolean
  }
  integrations: {
    useHostTopNav: boolean
    useHostTheme: boolean
    useHostSearch: boolean
  }
  environment: {
    label: string
    detail: string
  }
}

export const manaHubConfig: ManaHubHostConfig = {
  shell: {
    showSearch: true,
    showThemeToggle: true,
    showEnvironmentBadge: true,
    showSetupPage: true,
    showUserAvatar: true,
  },
  integrations: {
    useHostTopNav: false,
    useHostTheme: false,
    useHostSearch: false,
  },
  environment: {
    label: 'Production',
    detail: 'Self-hosted Supabase',
  },
}
