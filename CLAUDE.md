# MC Budget - Claude Code Instructions

## Project Overview

MC Budget is a personal finance application for managing wallets with fixed budget allocations. Built with SvelteKit 2, Svelte 5 (runes), TailwindCSS v4, DaisyUI v5, PocketBase, and Zod v4.

**This project uses experimental Svelte/SvelteKit features:**
- `compilerOptions.experimental.async` - Async components with top-level await
- `kit.experimental.remoteFunctions` - Type-safe client-server communication with Zod schemas

## Key Concepts

### Budget Immutability
- Wallets have a fixed budget allocation set at creation time
- Categories are stored as JSON on the wallet record, NOT as relations
- Budget percentages MUST total exactly 100%
- Once created, budget categories cannot be modified

### Architecture
```
src/lib/
├── *.remote.ts   # Remote functions (server-side, called from client)
├── schemas/      # Zod schemas for validation
├── server/       # Server-only modules (db client)
├── components/   # Reusable Svelte 5 components
├── stores/       # Svelte 5 reactive stores (.svelte.ts)
├── types/        # TypeScript type re-exports
└── validation/   # Validation helper functions
```

## Experimental Features

### Remote Functions (`*.remote.ts`)

Remote functions run on the server but can be called from client components. They provide type-safe client-server communication using Zod schemas.

**Four types of remote functions:**
- `query` - Read data (GET requests, cacheable)
- `command` - Mutate data (POST requests)
- `form` - Form submissions with progressive enhancement
- `prerender` - Static data computed at build time

**Syntax with Zod schemas:**
```typescript
// src/lib/wallets.remote.ts
import { z } from 'zod';
import { query, command } from '$app/server';
import { WalletSchema, CreateWalletInputSchema } from '$lib/schemas/budget';

// No arguments - just async function
export const getWallets = query(async () => {
  return await db.getAll();
});

// With argument - pass Zod schema first
export const getWallet = query(z.string(), async (id) => {
  return await db.getOne(id);
});

// Command with complex input
export const createWallet = command(CreateWalletInputSchema, async (input) => {
  return await db.create(input);
});
```

### Form Remote Functions

`form` returns attributes to spread on a `<form>` element:

```svelte
<script lang="ts">
  import { login } from '$lib/auth.remote';

  const loginForm = login;

  $effect(() => {
    if (loginForm.result?.user) {
      goto('/dashboard');
    }
  });
</script>

<form {...loginForm}>
  <input {...loginForm.fields.email.as('email')} />
  {#each loginForm.fields.email.issues() as issue}
    <span class="error">{issue.message}</span>
  {/each}

  <input {...loginForm.fields.password.as('password')} />

  <button type="submit" disabled={!!loginForm.pending}>
    Login
  </button>
</form>
```

### Async Components

With `experimental.async: true`, components can use `{#await}` blocks directly:

```svelte
<script lang="ts">
  import { getWallets } from '$lib/wallets.remote';

  const walletsPromise = getWallets();
</script>

{#await walletsPromise}
  <span class="loading loading-spinner"></span>
{:then wallets}
  {#each wallets as wallet}
    <WalletCard {wallet} />
  {/each}
{:catch error}
  <Alert type="error">{error.message}</Alert>
{/await}
```

### Reactive Async with `$derived`

For dynamic data that depends on reactive values:

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import { getWallet } from '$lib/wallets.remote';

  const walletId = $derived(page.params.id!);
  const walletPromise = $derived(getWallet(walletId));
</script>
```

## Zod v4 Schemas

All validation uses Zod v4 schemas defined in `src/lib/schemas/budget.ts`:

```typescript
import { z } from 'zod';

export const BudgetCategorySchema = z.object({
  name: z.string().min(1).max(100),
  percentage: z.number().min(0).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/)
});

export const CreateWalletInputSchema = z.object({
  name: z.string().min(1).max(100),
  balance: z.number().min(0),
  currency: z.string().length(3).regex(/^[A-Z]{3}$/),
  categories: z.array(BudgetCategorySchema)
    .refine(cats => Math.abs(cats.reduce((s, c) => s + c.percentage, 0) - 100) < 0.01)
});
```

**Zod v4 API notes:**
- Use `result.error.issues` (not `errors`) for validation errors
- Types are inferred with `z.infer<typeof Schema>`

## Coding Conventions

### Svelte 5 Runes
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
```svelte
<Card>
  {#snippet children()}
    Content here
  {/snippet}
</Card>
```

### Event Handlers
Use `onclick`, `onsubmit`, etc. (not `on:click`)

## PocketBase

### Migrations (Recommended)

Use JavaScript migrations for schema management. This is PocketBase's recommended approach for version control.

Reference: https://pocketbase.io/docs/js-migrations/

**Migration files location:** `pb_migrations/`

```javascript
// pb_migrations/1_collections.js
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  const wallets = new Collection({
    type: "base",
    name: "wallets",
    listRule: "@request.auth.id = user",
    fields: [
      { type: "relation", name: "user", required: true, collectionId: users.id, maxSelect: 1 },
      { type: "text", name: "name", required: true, max: 100 },
      { type: "number", name: "balance", required: true },
      { type: "json", name: "categories", required: true }
    ]
  });
  app.save(wallets);
}, (app) => {
  // Rollback
});
```

**Key points:**
- Look up collection IDs dynamically with `app.findCollectionByNameOrId("name")`
- Migrations auto-run on `pocketbase serve`
- Commit `pb_migrations/` to version control

## Important Files

| File | Purpose |
|------|---------|
| `svelte.config.js` | Experimental features enabled |
| `src/lib/schemas/budget.ts` | All Zod schemas |
| `src/lib/*.remote.ts` | Remote functions |
| `src/lib/server/db.ts` | Server-side PocketBase client |
| `src/lib/stores/*.svelte.ts` | Reactive stores |
| `pb_migrations/` | PocketBase schema migrations |

## Remote Function Files

| File | Functions |
|------|-----------|
| `wallets.remote.ts` | getWallets, getWallet, createWallet, deleteWallet |
| `transactions.remote.ts` | getTransactions, createTransaction, deleteTransaction |
| `presets.remote.ts` | getPresets (prerendered), getPreset |
| `auth.remote.ts` | login (form), register (form), logout, refreshAuth |

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

Use DaisyUI classes:
- Buttons: `btn btn-primary`, `btn-ghost`, `btn-sm`
- Cards: `card`, `card-body`, `card-title`
- Forms: `input input-bordered`, `select select-bordered`
- Alerts: `alert alert-error`, `alert-success`
- Loading: `loading loading-spinner`

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

### 1. list-sections
Use FIRST to discover available documentation sections.

### 2. get-documentation
Retrieves full documentation for specific sections.

### 3. svelte-autofixer
Analyzes Svelte code for issues. MUST use when writing Svelte components.

### 4. playground-link
Generates Svelte Playground links. Only use after user confirmation.
