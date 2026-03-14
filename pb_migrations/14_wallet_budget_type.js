migrate((app) => {
	const wallets = app.findCollectionByNameOrId("wallets");
	wallets.fields.add(new TextField({ name: "budget_type", required: false }));
	app.save(wallets);
}, (app) => {
	const wallets = app.findCollectionByNameOrId("wallets");
	wallets.fields.removeByName("budget_type");
	app.save(wallets);
});
