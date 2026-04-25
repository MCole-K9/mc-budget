/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const wallets = app.findCollectionByNameOrId("wallets");
  wallets.fields.add(new BoolField({ name: "carry_forward", required: false }));
  app.save(wallets);
}, (app) => {
  const wallets = app.findCollectionByNameOrId("wallets");
  wallets.fields.removeByName("carry_forward");
  app.save(wallets);
});
