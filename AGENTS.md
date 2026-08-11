# LMRing Development Guidelines

This document serves as a comprehensive guide for all team members when developing LMRing.

## Project Description

You are developing an open-source AI Arena for multi-model comparison: **LMRing**.

LMRing is a Next.js-based web application that enables users to interact with multiple AI models simultaneously, compare their responses in real-time, and track model performance through a leaderboard system.

## Tech Stack

Built with modern technologies:

- **Frontend**: Next.js 16, React 19, TypeScript 6.0+
- **UI**: shadcn/ui, Tailwind CSS 4
- **State**: Zustand
- **Database**: PostgreSQL, DrizzleORM
- **Auth**: Better-Auth (OAuth + email/password)
- **Testing**: Vitest, Playwright
- **Build**: Turborepo, pnpm
- **Linting**: Biome
- **i18n**: i18next, react-i18next (en, fr, zh)
- **AI**: Vercel AI SDK

## Directory Structure

- `apps/web/` - Main Next.js application
- `packages/` - Shared packages
  - `ai-hub/` - AI provider integration
  - `auth/` - Authentication
  - `config/` - Shared config (biome, tailwind, typescript, vitest)
  - `database/` - DrizzleORM schemas
  - `env/` - Environment variable management
  - `i18n/` - Internationalization
  - `model-depot/` - AI model definitions (50+ providers)
  - `storage/` - File storage (S3, Supabase)
  - `theme/` - Theme engine, tokens, presets, CSS variable generation
  - `ui/` - UI components
  - `video-runtime/` - Video generation runtime

## Development Workflow

### Git Workflow

- Use rebase for git pull
- Git commit messages should prefix with gitmoji
- Git branch name format: `<type>/<feature-name>`
- Use `.github/pull_request_template.md` for PR descriptions
- PR titles starting with `✨ feat/` or `🐛 fix` trigger release workflow

### Package Management

- Use `pnpm` as the primary package manager
- Workspace packages reference each other as `workspace:*`
- Add dependencies: `pnpm add <package> --filter <workspace>`

### Code Style Guidelines

#### TypeScript

- Prefer interfaces over types for object shapes
- Use explicit return types for functions
- Follow project's existing patterns
- Ensure type safety across the codebase

#### React

- Use functional components with hooks
- Prefer React Server Components when possible
- Use client components only when necessary (interactivity, hooks, browser APIs)
- Follow Next.js App Router patterns

### Testing Strategy

**Commands**:
- Web: `pnpm --filter @lmring/web test '[file-path-pattern]'`
- Packages: `pnpm --filter @lmring/<package> test '[file-path-pattern]'`

**Important**:
- Wrap file paths in single quotes
- Never run `pnpm test` - takes significant time
- Place test files next to source: `filename.test.ts`
- **Prefer `vi.spyOn` over `vi.mock`**
- Tests must pass type checking: `pnpm check:types`
- Write tests for business logic, not UI components

### Type Checking

- `pnpm check:types` - Check all packages
- `pnpm --filter <workspace> check:types` - Check specific package

### Linting

- `pnpm lint` - Check errors
- `pnpm lint:fix` - Auto-fix errors

### i18n

- **Keys**: Add to `apps/web/src/locales/{locale}.json`
- **Dev**: Translate all three locale files (en, fr, zh)
- Supported locales: `en`, `fr`, `zh`

## Quality Checks

### Pre-commit Hooks (Husky + lint-staged)

**Pre-commit**: Runs `lint-staged` (executes `lint:fix` and `check:types` on staged files)
**Commit-msg**: Validates conventional commits via commitlint

### Before Creating PR

1. Run `pnpm check:types`
2. Run `pnpm lint`
3. Run related tests
4. Test locally

## Important Notes

- **Node.js**: v24.11.1+
- **Package Manager**: pnpm 10.34.0
- **Auth**: OAuth (GitHub, Google, Linux.do) and Email OTP (Resend); all providers are optional and configured via environment variables

## Resources

For more detailed information, refer to:
- Project documentation in `/docs`
- CLAUDE.md for Claude Code guidelines
- Individual package README files
