/// <reference path="../pb_data/types.d.ts" />

// Runs daily at 6 AM. See recurring.js for how due schedules are resolved.
$app.cron().add("create-recurring-transactions", "0 6 * * *", () => {
    const { createRecurringTransactions } = require(`${__hooks}/recurring.js`);
    createRecurringTransactions($app, new Date());
});
