/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  // Get the users collection ID
  const users = app.findCollectionByNameOrId("users");

  // Create presets collection
  const presets = new Collection({
    type: "base",
    name: "presets",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "name", required: true, max: 100 },
      { type: "text", name: "description", max: 500 },
      { type: "json", name: "categories", required: true, maxSize: 2000000 }
    ]
  });
  app.save(presets);

  // Create wallets collection
  const wallets = new Collection({
    type: "base",
    name: "wallets",
    listRule: "@request.auth.id = user",
    viewRule: "@request.auth.id = user",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id = user",
    deleteRule: "@request.auth.id = user",
    fields: [
      { type: "relation", name: "user", required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 },
      { type: "text", name: "name", required: true, max: 100 },
      { type: "number", name: "balance", required: true },
      { type: "text", name: "currency", required: true, min: 3, max: 3, pattern: "^[A-Z]{3}$" },
      { type: "json", name: "categories", required: true, maxSize: 2000000 }
    ]
  });
  app.save(wallets);

  // Create transactions collection - need to get wallets ID after saving
  const savedWallets = app.findCollectionByNameOrId("wallets");

  const transactions = new Collection({
    type: "base",
    name: "transactions",
    listRule: "@request.auth.id = wallet.user",
    viewRule: "@request.auth.id = wallet.user",
    createRule: "@request.auth.id = wallet.user",
    updateRule: "@request.auth.id = wallet.user",
    deleteRule: "@request.auth.id = wallet.user",
    fields: [
      { type: "relation", name: "wallet", required: true, collectionId: savedWallets.id, cascadeDelete: true, maxSelect: 1 },
      { type: "text", name: "category", required: true, max: 100 },
      { type: "number", name: "amount", required: true },
      { type: "text", name: "description", max: 500 },
      { type: "date", name: "date", required: true }
    ]
  });
  app.save(transactions);

}, (app) => {
  // Rollback
  const collections = ["transactions", "wallets", "presets"];
  for (const name of collections) {
    try {
      const col = app.findCollectionByNameOrId(name);
      app.delete(col);
    } catch (e) {}
  }
});
