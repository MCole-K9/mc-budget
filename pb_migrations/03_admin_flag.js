/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new BoolField({ name: "admin", required: false }));

  // Prevent users from granting themselves admin via a regular update.
  // (@request.auth.id = id) already restricts to own record;
  // the extra clause blocks any request that includes an 'admin' body field.
  const current = users.updateRule ?? "";
  if (current && !current.includes("admin:isset")) {
    users.updateRule = "(" + current + ") && @request.body.admin:isset = false";
  } else if (!current) {
    users.updateRule = "@request.body.admin:isset = false";
  }

  app.save(users);

}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeByName("admin");
  // Restore original updateRule (strip our addition)
  if (users.updateRule) {
    users.updateRule = users.updateRule
      .replace(/ && @request\.body\.admin:isset = false$/, "")
      .replace(/^\(@request\.body\.admin:isset = false\)$/, "")
      .replace(/^\((.+)\)$/, "$1");
  }
  app.save(users);
});
