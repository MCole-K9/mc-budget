/// <reference path="../pb_data/types.d.ts" />

// Records could be created for another user (wallets, presets, user_settings) or moved into
// another user's wallet (transactions, recurring_schedules), and custom presets were visible to
// every user. Keep in sync with src/lib/server/tenantAccess.ts.

const approved = '@request.auth.approved = true';
const ownerCreate = "@request.auth.id != '' && @request.body.user = @request.auth.id";
const keepsOwner = '(@request.body.user:isset = false || @request.body.user = @request.auth.id)';
const keepsWallet =
	'(@request.body.wallet:isset = false || @request.body.wallet.user = @request.auth.id)';

const ownerRules = {
	presets: {
		listRule: "user = '' || user = @request.auth.id",
		viewRule: "user = '' || user = @request.auth.id",
		createRule: ownerCreate,
		updateRule: `@request.auth.id = user && ${keepsOwner}`,
		deleteRule: '@request.auth.id = user'
	},
	wallets: {
		listRule: '@request.auth.id = user.id',
		viewRule: '@request.auth.id = user.id',
		createRule: ownerCreate,
		updateRule: `@request.auth.id = user.id && ${keepsOwner}`,
		deleteRule: '@request.auth.id = user.id'
	},
	transactions: {
		listRule: '@request.auth.id = wallet.user.id',
		viewRule: '@request.auth.id = wallet.user.id',
		createRule: '@request.auth.id = wallet.user.id',
		updateRule: `@request.auth.id = wallet.user.id && ${keepsWallet}`,
		deleteRule: '@request.auth.id = wallet.user.id'
	},
	user_settings: {
		listRule: '@request.auth.id = user.id',
		viewRule: '@request.auth.id = user.id',
		createRule: ownerCreate,
		updateRule: `@request.auth.id = user.id && ${keepsOwner}`,
		deleteRule: '@request.auth.id = user.id'
	},
	recurring_schedules: {
		listRule: '@request.auth.id = wallet.user.id',
		viewRule: '@request.auth.id = wallet.user.id',
		createRule: '@request.auth.id = wallet.user.id',
		updateRule: `@request.auth.id = wallet.user.id && ${keepsWallet}`,
		deleteRule: '@request.auth.id = wallet.user.id'
	}
};

const previousRules = {
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

// Mirrors getPrivateInstance(): private unless the setting is explicitly 'false'
function isPrivateInstance(app) {
	try {
		const setting = app.findFirstRecordByFilter('app_settings', "skey = 'private_instance'");
		return setting.getString('value') !== 'false';
	} catch (_) {
		return true;
	}
}

function applyRules(app, tenantCollectionRules) {
	const withApproval = isPrivateInstance(app);
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
	(app) => applyRules(app, ownerRules),
	(app) => applyRules(app, previousRules)
);
