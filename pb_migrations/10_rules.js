/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const wallets = app.findCollectionByNameOrId("wallets");
  wallets.listRule = "@request.auth.id = user.id";
  wallets.viewRule = "@request.auth.id = user.id";
  wallets.createRule = "@request.auth.id != ''";
  wallets.updateRule = "@request.auth.id = user.id";
  wallets.deleteRule = "@request.auth.id = user.id";
  app.save(wallets);

  const transactions = app.findCollectionByNameOrId("transactions");
  transactions.listRule = "@request.auth.id = wallet.user.id";
  transactions.viewRule = "@request.auth.id = wallet.user.id";
  transactions.createRule = "@request.auth.id = wallet.user.id";
  transactions.updateRule = "@request.auth.id = wallet.user.id";
  transactions.deleteRule = "@request.auth.id = wallet.user.id";
  app.save(transactions);
}, (app) => {
  const wallets = app.findCollectionByNameOrId("wallets");
  wallets.listRule = null;
  wallets.viewRule = null;
  wallets.createRule = null;
  wallets.updateRule = null;
  wallets.deleteRule = null;
  app.save(wallets);

  const transactions = app.findCollectionByNameOrId("transactions");
  transactions.listRule = null;
  transactions.viewRule = null;
  transactions.createRule = null;
  transactions.updateRule = null;
  transactions.deleteRule = null;
  app.save(transactions);
});
