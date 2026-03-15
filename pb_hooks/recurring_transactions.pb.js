/// <reference path="../pb_data/types.d.ts" />

// Runs daily at 6 AM. For each recurring transaction whose recur_day matches
// today, creates a copy for the current month (if one hasn't been made yet).
$app.cron().add("create-recurring-transactions", "0 6 * * *", () => {
    const today = new Date();
    const day = today.getDate();
    const year = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const dateStr = `${year}-${mm}-${dd}`;
    const monthStart = `${year}-${mm}-01`;

    let templates;
    try {
        templates = $app.findRecordsByFilter(
            "transactions",
            `recurring = true && recur_day = ${day}`
        );
    } catch (_) {
        return;
    }

    for (const template of templates) {
        const walletId = template.getString("wallet");

        // Skip if a copy was already created this month for this template
        let existing;
        try {
            existing = $app.findRecordsByFilter(
                "transactions",
                `recurring_source_id = "${template.id}" && date >= "${monthStart}"`
            );
        } catch (_) {
            existing = [];
        }
        if (existing.length > 0) continue;

        // Create the copy
        const collection = $app.findCollectionByNameOrId("transactions");
        const copy = new Record(collection);
        copy.set("wallet", walletId);
        copy.set("category", template.getString("category"));
        copy.set("amount", template.get("amount"));
        copy.set("description", template.getString("description"));
        copy.set("date", dateStr);
        copy.set("recurring", false);
        copy.set("recur_day", 0);
        copy.set("recurring_source_id", template.id);
        $app.save(copy);

        // Update wallet balance (and total_funded for income)
        const wallet = $app.findRecordById("wallets", walletId);
        const amount = template.get("amount");
        wallet.set("balance", wallet.get("balance") + amount);
        if (amount > 0) {
            wallet.set("total_funded", wallet.get("total_funded") + amount);
        }
        $app.save(wallet);
    }
});
