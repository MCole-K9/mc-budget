/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const wallets = app.findCollectionByNameOrId("wallets");

  wallets.fields.add(new TextField({
    name: "default_period",
    required: false
  }));

  wallets.fields.add(new JSONField({
    name: "saved_periods",
    required: false,
    maxSize: 2000000
  }));

  app.save(wallets);
}, (app) => {
  const wallets = app.findCollectionByNameOrId("wallets");
  wallets.fields.removeByName("default_period");
  wallets.fields.removeByName("saved_periods");
  app.save(wallets);
});
