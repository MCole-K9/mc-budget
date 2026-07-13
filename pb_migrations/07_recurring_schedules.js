/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const wallets = app.findCollectionByNameOrId("wallets");

  const schedules = new Collection({
    type: "base",
    name: "recurring_schedules",
    listRule: "@request.auth.id = wallet.user.id",
    viewRule: "@request.auth.id = wallet.user.id",
    createRule: "@request.auth.id = wallet.user.id",
    updateRule: "@request.auth.id = wallet.user.id",
    deleteRule: "@request.auth.id = wallet.user.id",
  });
  schedules.fields.add(new RelationField({ name: "wallet", required: true, collectionId: wallets.id, cascadeDelete: true, maxSelect: 1 }));
  schedules.fields.add(new TextField({ name: "category", required: true, max: 100 }));
  schedules.fields.add(new TextField({ name: "description", max: 500 }));
  schedules.fields.add(new NumberField({ name: "amount", required: true }));
  schedules.fields.add(new NumberField({ name: "recur_day", required: true }));
  schedules.fields.add(new BoolField({ name: "active", required: false }));
  schedules.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
  schedules.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));
  app.save(schedules);

  // Auto-migrate existing recurring transactions to schedules
  try {
    const txs = app.findRecordsByFilter("transactions", "recurring = true && recurring_source_id = ''", "-date", 0, 0);
    const seen = {};
    for (const tx of txs) {
      const key = tx.get("wallet") + "|" + tx.get("category") + "|" + (tx.get("description") || "");
      let scheduleId = seen[key];
      if (!scheduleId) {
        const schedule = new Record(schedules);
        schedule.set("wallet", tx.get("wallet"));
        schedule.set("category", tx.get("category"));
        schedule.set("description", tx.get("description") || "");
        schedule.set("amount", tx.get("amount"));
        schedule.set("recur_day", tx.get("recur_day") || 1);
        schedule.set("active", true);
        app.save(schedule);
        scheduleId = schedule.id;
        seen[key] = scheduleId;
      }
      tx.set("recurring_source_id", scheduleId);
      app.save(tx);
    }
  } catch (e) {
    // No existing recurring transactions or minor API difference — safe to ignore
  }
}, (app) => {
  const schedules = app.findCollectionByNameOrId("recurring_schedules");
  app.delete(schedules);
});
