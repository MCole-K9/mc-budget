/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const presets = app.findCollectionByNameOrId("presets");

  // Allow authenticated users to create presets and delete their own
  presets.listRule = "";
  presets.viewRule = "";
  presets.createRule = "@request.auth.id != ''";
  presets.updateRule = "@request.auth.id = user";
  presets.deleteRule = "@request.auth.id = user";

  // Add optional user relation (existing seeded presets have no user)
  presets.fields.add(new RelationField({
    name: "user",
    required: false,
    collectionId: users.id,
    cascadeDelete: false,
    maxSelect: 1
  }));

  app.save(presets);
}, (app) => {
  const presets = app.findCollectionByNameOrId("presets");

  presets.listRule = "";
  presets.viewRule = "";
  presets.createRule = null;
  presets.updateRule = null;
  presets.deleteRule = null;

  presets.fields.removeByName("user");

  app.save(presets);
});
