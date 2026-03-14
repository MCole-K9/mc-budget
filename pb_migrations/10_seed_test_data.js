/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  // Always create the demo account (skip if already seeded)
  let user;
  try {
    user = app.findAuthRecordByEmail("users", "demo@mcbudget.com");
  } catch (_) {
    // Doesn't exist yet — create it
    const usersCol = app.findCollectionByNameOrId("users");
    user = new Record(usersCol);
    user.set("email", "demo@mcbudget.com");
    user.setPassword("demo1234demo");
    user.set("verified", true);
    app.save(user);
  }

  const walletsCol = app.findCollectionByNameOrId("wallets");
  const txCol = app.findCollectionByNameOrId("transactions");

  // Helper: create a transaction and update wallet balance/total_funded in one step
  function addTx(wallet, category, amount, description, date, opts = {}) {
    const tx = new Record(txCol);
    tx.set("wallet", wallet.id);
    tx.set("category", category);
    tx.set("amount", amount);
    tx.set("description", description);
    tx.set("date", date);
    tx.set("recurring", opts.recurring ?? false);
    tx.set("recur_day", opts.recur_day ?? 0);
    tx.set("recurring_source_id", opts.recurring_source_id ?? "");
    app.save(tx);

    wallet.set("balance", wallet.get("balance") + amount);
    if (amount > 0) {
      wallet.set("total_funded", wallet.get("total_funded") + amount);
    }
    app.save(wallet);
    return tx;
  }

  // ── Wallet 1: Main Checking ──────────────────────────────────────────
  const w1 = new Record(walletsCol);
  w1.set("user", user.id);
  w1.set("name", "Main Checking");
  w1.set("currency", "USD");
  w1.set("balance", 500);           // seed balance; transactions will update it
  w1.set("initial_balance", 500);
  w1.set("total_funded", 500);
  w1.set("categories", [
    { name: "Housing",       percentage: 35, color: "#6366F1" },
    { name: "Food",          percentage: 20, color: "#10B981" },
    { name: "Transport",     percentage: 15, color: "#F59E0B" },
    { name: "Entertainment", percentage: 10, color: "#EC4899" },
    { name: "Savings",       percentage: 20, color: "#3B82F6" }
  ]);
  app.save(w1);

  // January 2026
  addTx(w1, "Income",        4200,   "January Salary",           "2026-01-01");
  addTx(w1, "Housing",      -1400,   "Rent",                     "2026-01-02");
  addTx(w1, "Food",          -120,   "Grocery run",              "2026-01-05");
  addTx(w1, "Transport",     -85,    "Monthly transit pass",     "2026-01-06");
  addTx(w1, "Food",          -45,    "Restaurants",              "2026-01-10");
  addTx(w1, "Entertainment", -15,    "Netflix",                  "2026-01-12");
  addTx(w1, "Food",          -98,    "Grocery run",              "2026-01-18");
  addTx(w1, "Entertainment", -60,    "Dinner out",               "2026-01-22");
  addTx(w1, "Savings",       -400,   "Monthly savings transfer", "2026-01-28");

  // February 2026
  addTx(w1, "Income",        4200,   "February Salary",          "2026-02-01");
  addTx(w1, "Housing",      -1400,   "Rent",                     "2026-02-02");
  addTx(w1, "Food",          -115,   "Grocery run",              "2026-02-05");
  addTx(w1, "Transport",     -85,    "Monthly transit pass",     "2026-02-06");
  addTx(w1, "Food",          -38,    "Lunch out",                "2026-02-11");
  addTx(w1, "Entertainment", -15,    "Netflix",                  "2026-02-12");
  addTx(w1, "Transport",     -35,    "Uber rides",               "2026-02-14");
  addTx(w1, "Food",          -105,   "Grocery run",              "2026-02-19");
  addTx(w1, "Entertainment", -80,    "Concert tickets",          "2026-02-20");
  addTx(w1, "Savings",       -400,   "Monthly savings transfer", "2026-02-28");

  // March 2026 (current month)
  const rentTemplate = addTx(w1, "Housing", -1400, "Rent", "2026-03-01",
    { recurring: true, recur_day: 1 });
  addTx(w1, "Income",        4200,   "March Salary",             "2026-03-01");
  addTx(w1, "Food",          -132,   "Grocery run",              "2026-03-04");
  addTx(w1, "Transport",     -85,    "Monthly transit pass",     "2026-03-06");
  addTx(w1, "Food",          -22,    "Coffee & snacks",          "2026-03-08");
  addTx(w1, "Entertainment", -15,    "Netflix",                  "2026-03-12");
  addTx(w1, "Entertainment", -55,    "Birthday dinner",          "2026-03-13");

  // ── Wallet 2: Savings Account ────────────────────────────────────────
  const w2 = new Record(walletsCol);
  w2.set("user", user.id);
  w2.set("name", "Savings Account");
  w2.set("currency", "USD");
  w2.set("balance", 0);
  w2.set("initial_balance", 0);
  w2.set("total_funded", 0);
  w2.set("categories", [
    { name: "Emergency Fund", percentage: 50, color: "#EF4444" },
    { name: "Vacation",       percentage: 30, color: "#F59E0B" },
    { name: "Tech",           percentage: 20, color: "#8B5CF6" }
  ]);
  app.save(w2);

  addTx(w2, "Emergency Fund",  400, "Transfer from checking",  "2026-01-28");
  addTx(w2, "Emergency Fund",  400, "Transfer from checking",  "2026-02-28");
  addTx(w2, "Vacation",        -95, "Flight deal deposit",     "2026-02-15");
  addTx(w2, "Emergency Fund",  400, "Transfer from checking",  "2026-03-10");
  addTx(w2, "Tech",           -105, "SSD upgrade",             "2026-03-05");

}, (app) => {
  // Rollback: no-op — seed data is for dev only
});
