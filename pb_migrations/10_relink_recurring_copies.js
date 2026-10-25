/// <reference path="../pb_data/types.d.ts" />

// Before recurring schedules drove the cron hook, generated copies pointed
// recurring_source_id at their template transaction. Repoint them at the
// template's schedule so the hook sees them as that month's occurrence.
migrate((app) => {
  const copies = app.findRecordsByFilter("transactions", "recurring_source_id != ''", "", 0, 0);
  for (const copy of copies) {
    let template;
    try {
      template = app.findRecordById("transactions", copy.getString("recurring_source_id"));
    } catch (_) {
      continue; // already points at a schedule (or at nothing)
    }
    copy.set("recurring_source_id", template.getString("recurring_source_id"));
    app.save(copy);
  }
}, (app) => {
  // Not reversible: the original template ids are not kept
});
