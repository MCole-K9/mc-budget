/// <reference path="../pb_data/types.d.ts" />

// Creates this month's transaction for every active recurring schedule that is
// due (recur_day <= today) and has no transaction linked to it this month yet.
// The transaction a schedule was created from is linked too, so it counts as
// that month's occurrence. Catching up on earlier days covers missed cron runs.
function createRecurringTransactions(app, today) {
    const pad = (n) => String(n).padStart(2, "0");
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const monthStart = `${year}-${pad(month)}-01`;
    const nextMonthStart = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;

    let schedules;
    try {
        schedules = app.findRecordsByFilter(
            "recurring_schedules",
            "active = true && recur_day <= {:day}",
            "",
            0,
            0,
            { day }
        );
    } catch (_) {
        return 0;
    }

    let created = 0;
    for (const schedule of schedules) {
        try {
            const existing = app.findRecordsByFilter(
                "transactions",
                "recurring_source_id = {:id} && date >= {:start} && date < {:end}",
                "",
                1,
                0,
                { id: schedule.id, start: monthStart, end: nextMonthStart }
            );
            if (existing.length > 0) continue;

            const wallet = app.findRecordById("wallets", schedule.getString("wallet"));
            if (wallet.getBool("archived")) continue;

            const amount = schedule.getFloat("amount");
            if (amount === 0) continue;

            app.runInTransaction((txApp) => {
                const copy = new Record(txApp.findCollectionByNameOrId("transactions"));
                copy.set("wallet", wallet.id);
                copy.set("category", schedule.getString("category"));
                copy.set("amount", amount);
                copy.set("description", schedule.getString("description"));
                copy.set("date", `${year}-${pad(month)}-${pad(schedule.getInt("recur_day"))}`);
                copy.set("recurring", false);
                copy.set("recur_day", 0);
                copy.set("recurring_source_id", schedule.id);
                txApp.save(copy);

                const w = txApp.findRecordById("wallets", wallet.id);
                w.set("balance", w.getFloat("balance") + amount);
                if (amount > 0) {
                    w.set("total_funded", w.getFloat("total_funded") + amount);
                }
                txApp.save(w);
            });
            created++;
        } catch (err) {
            console.log(`[recurring] schedule ${schedule.id} failed: ${err}`);
        }
    }
    return created;
}

module.exports = { createRecurringTransactions };
