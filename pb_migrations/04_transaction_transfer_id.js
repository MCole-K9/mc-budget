/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const transactions = app.findCollectionByNameOrId("transactions");
  transactions.fields.add(new TextField({ name: "transfer_id", required: false, max: 100 }));
  app.save(transactions);
}, (app) => {
  const transactions = app.findCollectionByNameOrId("transactions");
  transactions.fields.removeByName("transfer_id");
  app.save(transactions);
});
