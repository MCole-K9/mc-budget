# MC Budget

A personal budget management system built with SvelteKit, PocketBase, TailwindCSS v4, and DaisyUI v5.

## Features

- **Wallet Management**: Create wallets with custom budget allocations
- **Budget Templates**: Choose from proven budget methods (50/30/20, Zero-Based, Envelope System)
- **Transaction Tracking**: Log income and expenses by category
- **Immutable Budgets**: Budget allocations are set at wallet creation and cannot be modified
- **Dark/Light Mode**: Theme toggle with localStorage persistence
- **User Authentication**: Secure login/registration via PocketBase

## Tech Stack

- **Frontend**: SvelteKit 2, Svelte 5 (runes)
- **Styling**: TailwindCSS v4, DaisyUI v5
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

1. Download and run PocketBase:
   ```bash
   ./pocketbase serve
   ```

2. Open the admin UI at `http://127.0.0.1:8090/_/`

3. Import the schema from `pocketbase-schema.json` or manually create collections:

   **Collections:**
   - `presets` - Budget templates (public read)
   - `wallets` - User wallets (user-scoped)
   - `transactions` - Financial transactions (wallet-scoped)

### 4. Run Development Server

```bash
bun run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

```
src/
├── lib/
│   ├── api/              # PocketBase API utilities
│   │   ├── auth.ts       # Authentication functions
│   │   ├── pocketbase.ts # PocketBase client
│   │   ├── presets.ts    # Budget preset operations
│   │   ├── transactions.ts
│   │   └── wallets.ts
│   ├── components/       # Svelte components
│   │   ├── Alert.svelte
│   │   ├── AuthGuard.svelte
│   │   ├── BudgetCategoryInput.svelte
│   │   ├── BudgetCategoryList.svelte
│   │   ├── BudgetPresetSelector.svelte
│   │   ├── Button.svelte
│   │   ├── Card.svelte
│   │   ├── Input.svelte
│   │   ├── Modal.svelte
│   │   ├── Select.svelte
│   │   ├── ThemeToggle.svelte
│   │   ├── TransactionForm.svelte
│   │   ├── TransactionList.svelte
│   │   └── WalletCard.svelte
│   ├── stores/           # Svelte 5 reactive stores
│   │   ├── auth.svelte.ts
│   │   └── theme.svelte.ts
│   ├── types/            # TypeScript definitions
│   │   └── budget.ts
│   └── validation/       # Input validation
│       └── budget.ts
└── routes/
    ├── +layout.svelte    # App shell with navigation
    ├── +page.svelte      # Home/dashboard
    ├── auth/
    │   ├── login/
    │   └── register/
    ├── presets/          # Browse budget templates
    └── wallets/
        ├── +page.svelte  # Wallet list
        ├── new/          # Create wallet wizard
        └── [id]/         # Wallet detail + transactions
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

1. **Immutable Budgets**: Once a wallet is created, its budget categories cannot be changed. This enforces financial discipline and simplifies the data model.

2. **Categories on Wallet**: Budget categories are stored as JSON on the wallet record (not as relations). This ensures immutability and simplifies queries.

3. **100% Validation**: Client and server validate that category percentages total exactly 100%.

4. **Default Presets**: Three popular budget methods are available without database setup.

## License

MIT
