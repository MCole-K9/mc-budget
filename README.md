# MC Budget

A personal budget management system built with SvelteKit, PocketBase, TailwindCSS v4, DaisyUI v5, and Zod v4.

## Features

- **Wallet Management**: Create wallets with custom budget allocations
- **Budget Templates**: Choose from proven budget methods (50/30/20, Zero-Based, Envelope System)
- **Transaction Tracking**: Log income and expenses by category
- **Immutable Budgets**: Budget allocations are set at wallet creation and cannot be modified
- **Dark/Light Mode**: Theme toggle with localStorage persistence
- **User Authentication**: Secure login/registration via PocketBase
- **Type-Safe API**: Remote functions with Zod schema validation

## Experimental Features

This project uses cutting-edge SvelteKit experimental features:

- **Remote Functions** (`kit.experimental.remoteFunctions`) - Type-safe client-server communication
- **Async Components** (`compilerOptions.experimental.async`) - Top-level await in components

## Tech Stack

- **Frontend**: SvelteKit 2, Svelte 5 (runes)
- **Styling**: TailwindCSS v4, DaisyUI v5
- **Validation**: Zod v4
- **Backend**: PocketBase
- **Runtime**: Bun

## Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- [PocketBase](https://pocketbase.io/) (v0.20+)

## Getting Started

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` if your PocketBase instance runs on a different URL:

```env
PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090
```

### 3. Set Up PocketBase

1. Copy the migrations folder to your PocketBase directory:
   ```bash
   cp -r pb_migrations /path/to/pocketbase/
   ```

2. Run PocketBase (migrations apply automatically):
   ```bash
   ./pocketbase serve
   ```

3. Open the admin UI at `http://127.0.0.1:8090/_/` and create an admin account

   The migrations create:
   - `presets` - Budget templates (public read)
   - `wallets` - User wallets (user-scoped)
   - `transactions` - Financial transactions (wallet-scoped)
   - Default budget presets (50/30/20, Zero-Based, Envelope)

### 4. Run Development Server

```bash
bun run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

```
src/lib/
├── *.remote.ts       # Remote functions (query, command, form, prerender)
├── schemas/          # Zod v4 validation schemas
│   └── budget.ts     # All type schemas
├── server/           # Server-only modules
│   └── db.ts         # PocketBase client
├── components/       # Svelte 5 components
├── stores/           # Reactive stores (.svelte.ts)
├── types/            # Type re-exports
└── validation/       # Validation helpers
```

## Remote Functions

This project uses SvelteKit's experimental remote functions for type-safe client-server communication:

```typescript
// src/lib/wallets.remote.ts
import { z } from 'zod';
import { query, command } from '$app/server';

// Query with Zod schema validation
export const getWallet = query(z.string(), async (id) => {
  return await db.collection('wallets').getOne(id);
});

// Command for mutations
export const createWallet = command(CreateWalletSchema, async (input) => {
  return await db.collection('wallets').create(input);
});
```

## Budget Presets

### 50/30/20 Rule
- **Needs**: 50% - Essential expenses (housing, utilities, food)
- **Wants**: 30% - Non-essential spending (entertainment, dining out)
- **Savings**: 20% - Savings and debt repayment

### Zero-Based Budget
Allocate every dollar across 8 categories:
- Housing (25%), Transportation (15%), Food (15%)
- Utilities (10%), Insurance (10%), Savings (10%)
- Personal (10%), Entertainment (5%)

### Envelope System
Simple three-category approach:
- **Essentials**: 60%
- **Financial Goals**: 20%
- **Lifestyle**: 20%

## Scripts

```bash
bun run dev        # Start development server
bun run build      # Build for production
bun run preview    # Preview production build
bun run check      # Type-check the codebase
bun run lint       # Run linter
bun run format     # Format code with Prettier
bun run test       # Run all tests
bun run test:unit  # Run unit tests
bun run test:e2e   # Run E2E tests
```

## Key Design Decisions

1. **Immutable Budgets**: Once a wallet is created, its budget categories cannot be changed.

2. **Remote Functions**: Server-side logic runs via remote functions, providing type safety and automatic validation.

3. **Zod v4 Schemas**: All input validation uses Zod schemas, ensuring consistent validation on client and server.

4. **Async Components**: Components use top-level await for cleaner data loading patterns.

5. **100% Validation**: Category percentages must total exactly 100%.

## License

MIT
