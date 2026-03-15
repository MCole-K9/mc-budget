/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const transactions = app.findCollectionByNameOrId("transactions");

  transactions.fields.add(new FileField({
    name: "receipt",
    required: false,
    maxSize: 5242880,
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]
  }));

  app.save(transactions);
}, (app) => {
  const transactions = app.findCollectionByNameOrId("transactions");
  transactions.fields.removeByName("receipt");
  app.save(transactions);
});
