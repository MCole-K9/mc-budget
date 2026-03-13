/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const wallets = app.findCollectionByNameOrId("wallets");

  wallets.fields.add(new NumberField({
    name: "total_funded",
    required: false
  }));

  app.save(wallets);

  // Seed total_funded = initial_balance + sum of income transactions
  const walletRecords = app.findRecordsByFilter(wallets, "1=1");
  for (const wallet of walletRecords) {
    const initialBalance = wallet.get("initial_balance") || 0;
    const transactions = app.findRecordsByFilter(
      "transactions",
      `wallet = "${wallet.id}" && amount > 0`
    );
    const incomeSum = transactions.reduce((sum, t) => sum + t.get("amount"), 0);
    wallet.set("total_funded", initialBalance + incomeSum);
    app.save(wallet);
  }
}, (app) => {
  const wallets = app.findCollectionByNameOrId("wallets");
  wallets.fields.removeByName("total_funded");
  app.save(wallets);
});
