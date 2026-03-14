/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const transactions = app.findCollectionByNameOrId("transactions");

  transactions.fields.add(new BoolField({
    name: "recurring",
    required: false
  }));

  transactions.fields.add(new NumberField({
    name: "recur_day",
    required: false
  }));

  // Stores the ID of the template transaction that spawned this copy
  transactions.fields.add(new TextField({
    name: "recurring_source_id",
    required: false
  }));

  app.save(transactions);
}, (app) => {
  const transactions = app.findCollectionByNameOrId("transactions");
  transactions.fields.removeByName("recurring");
  transactions.fields.removeByName("recur_day");
  transactions.fields.removeByName("recurring_source_id");
  app.save(transactions);
});
