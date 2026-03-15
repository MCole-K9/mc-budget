/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const wallets = app.findCollectionByNameOrId("wallets");

  wallets.fields.add(new NumberField({
    name: "initial_balance",
    required: false
  }));

  app.save(wallets);

  // Seed initial_balance from current balance on existing wallets
  const records = app.findRecordsByFilter(wallets, "1=1");
  for (const record of records) {
    record.set("initial_balance", record.get("balance"));
    app.save(record);
  }
}, (app) => {
  const wallets = app.findCollectionByNameOrId("wallets");
  wallets.fields.removeByName("initial_balance");
  app.save(wallets);
});
