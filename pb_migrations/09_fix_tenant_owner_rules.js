/// <reference path="../pb_data/types.d.ts" />

const approved = '@request.auth.approved = true';

const tenantCollectionRules = {
	presets: {
		listRule: '',
		viewRule: '',
		createRule: "@request.auth.id != ''",
		updateRule: '@request.auth.id = user',
		deleteRule: '@request.auth.id = user'
	},
	wallets: {
		listRule: '@request.auth.id = user.id',
		viewRule: '@request.auth.id = user.id',
		createRule: "@request.auth.id != ''",
		updateRule: '@request.auth.id = user.id',
		deleteRule: '@request.auth.id = user.id'
	},
	transactions: {
		listRule: '@request.auth.id = wallet.user.id',
		viewRule: '@request.auth.id = wallet.user.id',
		createRule: '@request.auth.id = wallet.user.id',
		updateRule: '@request.auth.id = wallet.user.id',
		deleteRule: '@request.auth.id = wallet.user.id'
	},
	user_settings: {
		listRule: '@request.auth.id = user.id',
		viewRule: '@request.auth.id = user.id',
		createRule: "@request.auth.id != ''",
		updateRule: '@request.auth.id = user.id',
		deleteRule: '@request.auth.id = user.id'
	},
	recurring_schedules: {
		listRule: '@request.auth.id = wallet.user.id',
		viewRule: '@request.auth.id = wallet.user.id',
		createRule: '@request.auth.id = wallet.user.id',
		updateRule: '@request.auth.id = wallet.user.id',
		deleteRule: '@request.auth.id = wallet.user.id'
	}
};

function approvedRule(rule) {
	return rule ? `(${approved}) && (${rule})` : approved;
}

function setTenantCollectionRules(app, withApproval) {
	for (const [collectionName, rules] of Object.entries(tenantCollectionRules)) {
		const collection = app.findCollectionByNameOrId(collectionName);
		collection.listRule = withApproval ? approvedRule(rules.listRule) : rules.listRule;
		collection.viewRule = withApproval ? approvedRule(rules.viewRule) : rules.viewRule;
		collection.createRule = withApproval ? approvedRule(rules.createRule) : rules.createRule;
		collection.updateRule = withApproval ? approvedRule(rules.updateRule) : rules.updateRule;
		collection.deleteRule = withApproval ? approvedRule(rules.deleteRule) : rules.deleteRule;
		app.save(collection);
	}
}

migrate(
	(app) => setTenantCollectionRules(app, true),
	(app) => setTenantCollectionRules(app, false)
);
