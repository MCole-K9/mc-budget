/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  const userSettings = new Collection({
    type: "base",
    name: "user_settings",
    listRule: "@request.auth.id = user.id",
    viewRule: "@request.auth.id = user.id",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id = user.id",
    deleteRule: "@request.auth.id = user.id"
  });
  userSettings.fields.add(new RelationField({ name: "user", required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 }));
  userSettings.fields.add(new TextField({ name: "skey", required: true, max: 100 }));
  userSettings.fields.add(new TextField({ name: "value", required: false }));
  userSettings.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
  userSettings.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));
  app.save(userSettings);

}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("user_settings");
    app.delete(col);
  } catch (e) {}
});
