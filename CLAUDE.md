# MC Budget - Claude Code Instructions

## Project Overview

MC Budget is a personal finance application for managing wallets with fixed budget allocations. Built with SvelteKit 2, Svelte 5 (runes), TailwindCSS v4, DaisyUI v5, and PocketBase.

## Key Concepts

### Budget Immutability
- Wallets have a fixed budget allocation set at creation time
- Categories are stored as JSON on the wallet record, NOT as relations
- Budget percentages MUST total exactly 100%
- Once created, budget categories cannot be modified

### Architecture
```
src/lib/
├── api/          # PocketBase CRUD operations
├── components/   # Reusable Svelte 5 components
├── stores/       # Svelte 5 reactive stores (.svelte.ts)
├── types/        # TypeScript interfaces
└── validation/   # Input validation functions
```

## Coding Conventions

### Svelte 5 Runes
This project uses Svelte 5 runes exclusively:
- `$state()` for reactive state
- `$derived()` for computed values
- `$effect()` for side effects
- `$props()` for component props
- `$bindable()` for two-way binding

### Component Props Pattern
```svelte
<script lang="ts">
  interface Props {
    value: string;
    onchange?: (value: string) => void;
  }
  let { value = $bindable(), onchange }: Props = $props();
</script>
```

### Snippets (not slots)
Use Svelte 5 snippets instead of slots:
```svelte
<!-- Parent -->
<Card>
  {#snippet children()}
    Content here
  {/snippet}
</Card>

<!-- Card.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  interface Props {
    children: Snippet;
  }
  let { children }: Props = $props();
</script>
<div>{@render children()}</div>
```

### Event Handlers
Use `onclick`, `onsubmit`, etc. (not `on:click`):
```svelte
<button onclick={handleClick}>Click</button>
<form onsubmit={handleSubmit}>...</form>
```

## Important Files

| File | Purpose |
|------|---------|
| `src/lib/types/budget.ts` | All TypeScript interfaces |
| `src/lib/validation/budget.ts` | Validation functions (categories must = 100%) |
| `src/lib/api/presets.ts` | Default budget templates (50/30/20, etc.) |
| `src/lib/stores/auth.svelte.ts` | Authentication state |
| `src/lib/stores/theme.svelte.ts` | Dark/light mode |
| `pocketbase-schema.json` | Database collection definitions |

## Validation Rules

### Budget Categories
- Total percentage MUST equal exactly 100%
- No duplicate category names
- Each percentage must be 0-100
- Color must be valid hex (#RRGGBB)

### Wallets
- Name required, max 100 chars
- Balance >= 0
- Currency must be 3-letter code (USD, EUR, etc.)

### Transactions
- Category must exist in wallet
- Amount cannot be zero
- Date required

## DaisyUI Components

Use DaisyUI classes for UI consistency:
- Buttons: `btn btn-primary`, `btn btn-ghost`, `btn-sm`, `btn-lg`
- Cards: `card`, `card-body`, `card-title`
- Forms: `input input-bordered`, `select select-bordered`
- Alerts: `alert alert-error`, `alert-success`
- Loading: `loading loading-spinner`

## Common Tasks

### Adding a New Component
1. Create in `src/lib/components/`
2. Use Props interface pattern
3. Run through svelte-autofixer
4. Use DaisyUI classes for styling

### Adding API Functionality
1. Add types to `src/lib/types/budget.ts`
2. Add validation to `src/lib/validation/budget.ts`
3. Create API functions in `src/lib/api/`
4. API functions should validate before PocketBase calls

### Adding a New Route
1. Create directory in `src/routes/`
2. Add `+page.svelte` and `+page.server.ts`
3. Use `AuthGuard` component for protected routes
4. Load data client-side via API utilities

## Testing

```bash
bun run check      # TypeScript + Svelte check
bun run test:unit  # Vitest unit tests
bun run test:e2e   # Playwright E2E tests
```

## Environment

- `PUBLIC_POCKETBASE_URL` - PocketBase server URL (default: http://127.0.0.1:8090)

---

## Svelte MCP Tools

You have access to the Svelte MCP server with comprehensive Svelte 5 and SvelteKit documentation.

### 1. list-sections
Use FIRST to discover available documentation sections. Returns structured list with titles, use_cases, and paths.

### 2. get-documentation
Retrieves full documentation for specific sections. After list-sections, fetch ALL relevant sections for the user's task.

### 3. svelte-autofixer
Analyzes Svelte code for issues. MUST use when writing Svelte components. Keep calling until no issues remain.

### 4. playground-link
Generates Svelte Playground links. Only use after user confirmation and NEVER if code was written to project files.
