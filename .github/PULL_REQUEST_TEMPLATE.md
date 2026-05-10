# Summary

<!-- One paragraph: what does this PR change and why. -->

# Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Refactor / internal cleanup
- [ ] CI / tooling
- [ ] Migration (database schema)
- [ ] Breaking change

# Pre-flight checklist

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes (and `cd bridge && npm run typecheck` if Bridge changed)
- [ ] `npm run doctor` passes (in demo mode)
- [ ] `npm run build` passes
- [ ] No secrets, real customer data, real prompts, or `/Users/...` paths in
      the diff
- [ ] If migrations changed: every statement is idempotent (re-running the
      file is safe), and `MIGRATIONS.md` is updated
- [ ] If user-visible behaviour changed: docs / `README.md` / `UPGRADE.md`
      reflect it
- [ ] If the change affects the Bridge or LaunchAgents: tested locally

# Related issues

<!-- Closes #123 / Refs #456 -->

# Screenshots / output

<!-- Optional: dashboard screenshots, doctor output, log snippets. -->

# License

By submitting this pull request you agree that your contribution is licensed
under the terms of `LICENSE.md` (Mana Hub Community License) and may be used
under `COMMERCIAL-LICENSE.md` for commercial relicensing.
