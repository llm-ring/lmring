# GEMINI.md

This document serves as a shared guideline for all team members when using Gemini CLI in this opensource LMRing repository.

## Tech Stack

- **Framework**: Next.js 16, React 19, TypeScript 6.0+
- **Build System**: Turborepo with pnpm workspaces
- **UI**: shadcn/ui, Tailwind CSS 4
- **State**: Zustand
- **Database**: PostgreSQL, DrizzleORM
- **Auth**: Better-Auth
- **Testing**: Vitest, Playwright
- **Linting**: Biome
- **i18n**: i18next, react-i18next (en, fr, zh)
- **AI**: Vercel AI SDK

## Directory Structure

```
lmring/
├── apps/web/         # Next.js application
└── packages/         # Shared packages
    ├── ai-hub/       # AI provider integration
    ├── auth/         # Authentication
    ├── config/       # Shared config (biome, tailwind, typescript, vitest)
    ├── database/     # DrizzleORM schemas
    ├── env/          # Environment variable management
    ├── i18n/         # Internationalization
    ├── model-depot/  # AI model definitions
    ├── storage/      # File storage (S3, Supabase)
    ├── theme/        # Theme engine, tokens, presets, CSS variable generation
    ├── ui/           # UI components
    └── video-runtime/ # Video generation runtime
```

## Development

### Git Workflow

- Use rebase for git pull
- Git commit message should prefix with gitmoji
- Git branch name format: `<type>/<feature-name>`
- Use `.github/pull_request_template.md` for PR description
- PR titles starting with `✨ feat/` or `🐛 fix` trigger release workflow

### Package Management

- Use `pnpm` as the primary package manager
- Workspace packages reference each other as `workspace:*`

### Testing

**Commands**:
- Web: `pnpm --filter @lmring/web test '[file-path-pattern]'`
- Packages: `pnpm --filter @lmring/<package> test '[file-path-pattern]'`

**Important**:
- Wrap file paths in single quotes
- Never run `pnpm test` (runs all tests, takes significant time)
- Stop and ask for help if test fails twice
- **Prefer `vi.spyOn` over `vi.mock`**
- Tests must pass type check: `pnpm check:types`

### Typecheck

- `pnpm check:types` - Check all packages
- `pnpm --filter <workspace> check:types` - Check specific package

### Linting

- `pnpm lint` - Check errors
- `pnpm lint:fix` - Auto-fix errors

### i18n

- **Keys**: Add to `apps/web/src/locales/{locale}.json`
- **Dev**: Translate all three locale files (en, fr, zh)
- Supported locales: `en`, `fr`, `zh`

## 🚨 Quality Checks

**MANDATORY**: After completing code changes, always run `mcp__ide__getDiagnostics` (if available) on modified files to identify errors.

If diagnostics tool is not available:
- Run `pnpm check:types` to ensure no type errors
- Run `pnpm lint` to check for linting issues
- Manually review your changes

### Database

- `pnpm db:generate` - Generate migrations
- `pnpm db:migrate` - Run migrations (requires env vars)
- `pnpm db:studio` - Open Drizzle Studio

## Essential Commands

```bash
pnpm dev              # Start dev server
pnpm build            # Build all packages
pnpm check:types      # Type check
pnpm lint:fix         # Lint and fix
pnpm test             # Run tests (avoid, use filtered tests)
pnpm test:e2e         # Run E2E tests
```

## Git Hooks (Husky + lint-staged)

**Pre-commit**: Runs `lint-staged` (executes `lint:fix` and `check:types` on staged files)
**Commit-msg**: Validates conventional commits via commitlint

## Important Notes

- **Node.js**: v24.11.1+
- **Package Manager**: pnpm 10.34.0
- **Dev Server**: Turbopack
