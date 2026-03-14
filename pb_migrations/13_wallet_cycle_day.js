/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const wallets = app.findCollectionByNameOrId("wallets");

  wallets.fields.add(new NumberField({
    name: "cycle_start_day",
    required: false,
    min: 1,
    max: 28
  }));

  app.save(wallets);
}, (app) => {
  const wallets = app.findCollectionByNameOrId("wallets");
  wallets.fields.removeByName("cycle_start_day");
  app.save(wallets);
});
