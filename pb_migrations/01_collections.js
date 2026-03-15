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
    deleteRule: null
  });
  presets.fields.add(new TextField({ name: "name", required: true, max: 100 }));
  presets.fields.add(new TextField({ name: "description", max: 500 }));
  presets.fields.add(new JSONField({ name: "categories", required: true, maxSize: 2000000 }));
  presets.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
  presets.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));
  app.save(presets);

  // Create wallets collection (rules set in 10_rules.js after schema is committed)
  const wallets = new Collection({
    type: "base",
    name: "wallets",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null
  });
  wallets.fields.add(new RelationField({ name: "user", required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 }));
  wallets.fields.add(new TextField({ name: "name", required: true, max: 100 }));
  wallets.fields.add(new NumberField({ name: "balance", required: true }));
  wallets.fields.add(new TextField({ name: "currency", required: true, min: 3, max: 3, pattern: "^[A-Z]{3}$" }));
  wallets.fields.add(new JSONField({ name: "categories", required: true, maxSize: 2000000 }));
  wallets.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
  wallets.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));
  app.save(wallets);

  // Create transactions collection
  const savedWallets = app.findCollectionByNameOrId("wallets");

  const transactions = new Collection({
    type: "base",
    name: "transactions",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null
  });
  transactions.fields.add(new RelationField({ name: "wallet", required: true, collectionId: savedWallets.id, cascadeDelete: true, maxSelect: 1 }));
  transactions.fields.add(new TextField({ name: "category", required: true, max: 100 }));
  transactions.fields.add(new NumberField({ name: "amount", required: true }));
  transactions.fields.add(new TextField({ name: "description", max: 500 }));
  transactions.fields.add(new DateField({ name: "date", required: true }));
  transactions.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
  transactions.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));
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
