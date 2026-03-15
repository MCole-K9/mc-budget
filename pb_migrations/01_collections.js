/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  const presets = new Collection({
    type: "base",
    name: "presets",
    listRule: "",
    viewRule: "",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id = user",
    deleteRule: "@request.auth.id = user"
  });
  presets.fields.add(new TextField({ name: "name", required: true, max: 100 }));
  presets.fields.add(new TextField({ name: "description", max: 500 }));
  presets.fields.add(new JSONField({ name: "categories", required: true, maxSize: 2000000 }));
  presets.fields.add(new RelationField({ name: "user", required: false, collectionId: users.id, cascadeDelete: false, maxSelect: 1 }));
  presets.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
  presets.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));
  app.save(presets);

  const wallets = new Collection({
    type: "base",
    name: "wallets",
    listRule: "@request.auth.id = user.id",
    viewRule: "@request.auth.id = user.id",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id = user.id",
    deleteRule: "@request.auth.id = user.id"
  });
  wallets.fields.add(new RelationField({ name: "user", required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 }));
  wallets.fields.add(new TextField({ name: "name", required: true, max: 100 }));
  wallets.fields.add(new NumberField({ name: "balance", required: false }));
  wallets.fields.add(new TextField({ name: "currency", required: true, min: 3, max: 3, pattern: "^[A-Z]{3}$" }));
  wallets.fields.add(new JSONField({ name: "categories", required: true, maxSize: 2000000 }));
  wallets.fields.add(new NumberField({ name: "initial_balance", required: false }));
  wallets.fields.add(new NumberField({ name: "total_funded", required: false }));
  wallets.fields.add(new TextField({ name: "default_period", required: false }));
  wallets.fields.add(new JSONField({ name: "saved_periods", required: false, maxSize: 2000000 }));
  wallets.fields.add(new NumberField({ name: "cycle_start_day", required: false, min: 1, max: 28 }));
  wallets.fields.add(new TextField({ name: "budget_type", required: false }));
  wallets.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
  wallets.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));
  app.save(wallets);

  const savedWallets = app.findCollectionByNameOrId("wallets");
  const transactions = new Collection({
    type: "base",
    name: "transactions",
    listRule: "@request.auth.id = wallet.user.id",
    viewRule: "@request.auth.id = wallet.user.id",
    createRule: "@request.auth.id = wallet.user.id",
    updateRule: "@request.auth.id = wallet.user.id",
    deleteRule: "@request.auth.id = wallet.user.id"
  });
  transactions.fields.add(new RelationField({ name: "wallet", required: true, collectionId: savedWallets.id, cascadeDelete: true, maxSelect: 1 }));
  transactions.fields.add(new TextField({ name: "category", required: true, max: 100 }));
  transactions.fields.add(new NumberField({ name: "amount", required: true }));
  transactions.fields.add(new TextField({ name: "description", max: 500 }));
  transactions.fields.add(new DateField({ name: "date", required: true }));
  transactions.fields.add(new FileField({ name: "receipt", required: false, maxSize: 5242880, mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"] }));
  transactions.fields.add(new BoolField({ name: "recurring", required: false }));
  transactions.fields.add(new NumberField({ name: "recur_day", required: false }));
  transactions.fields.add(new TextField({ name: "recurring_source_id", required: false }));
  transactions.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
  transactions.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));
  app.save(transactions);

  const appSettings = new Collection({
    type: "base",
    name: "app_settings",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null
  });
  appSettings.fields.add(new TextField({ name: "skey", required: true }));
  appSettings.fields.add(new TextField({ name: "value", required: false }));
  app.save(appSettings);

  const presetData = [
    {
      name: "50/30/20 Rule",
      description: "A simple budgeting method: 50% for needs, 30% for wants, and 20% for savings.",
      categories: [
        { name: "Needs", percentage: 50, color: "#3B82F6" },
        { name: "Wants", percentage: 30, color: "#10B981" },
        { name: "Savings", percentage: 20, color: "#F59E0B" }
      ]
    },
    {
      name: "Zero-Based Budget",
      description: "Allocate every dollar to specific categories until you reach zero.",
      categories: [
        { name: "Housing", percentage: 25, color: "#3B82F6" },
        { name: "Transportation", percentage: 15, color: "#10B981" },
        { name: "Food", percentage: 15, color: "#F59E0B" },
        { name: "Utilities", percentage: 10, color: "#EF4444" },
        { name: "Insurance", percentage: 10, color: "#8B5CF6" },
        { name: "Savings", percentage: 10, color: "#EC4899" },
        { name: "Personal", percentage: 10, color: "#06B6D4" },
        { name: "Entertainment", percentage: 5, color: "#84CC16" }
      ]
    },
    {
      name: "Envelope System",
      description: "A cash-based system with three main spending categories.",
      categories: [
        { name: "Essentials", percentage: 60, color: "#3B82F6" },
        { name: "Financial Goals", percentage: 20, color: "#10B981" },
        { name: "Lifestyle", percentage: 20, color: "#F59E0B" }
      ]
    }
  ];

  const savedPresets = app.findCollectionByNameOrId("presets");
  for (const preset of presetData) {
    const record = new Record(savedPresets);
    record.set("name", preset.name);
    record.set("description", preset.description);
    record.set("categories", preset.categories);
    app.save(record);
  }

}, (app) => {
  const collections = ["transactions", "wallets", "presets", "app_settings"];
  for (const name of collections) {
    try {
      const col = app.findCollectionByNameOrId(name);
      app.delete(col);
    } catch (e) {}
  }
});
