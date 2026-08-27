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

function hasRuleExpression(rule) {
	return typeof rule === 'string' && rule.trim() !== '' && rule.trim() !== '()';
}

function approvedRule(rule) {
	return hasRuleExpression(rule) ? `(${approved}) && (${rule})` : approved;
}

function setTenantCollectionRules(app) {
	for (const [collectionName, rules] of Object.entries(tenantCollectionRules)) {
		const collection = app.findCollectionByNameOrId(collectionName);
		collection.listRule = approvedRule(rules.listRule);
		collection.viewRule = approvedRule(rules.viewRule);
		collection.createRule = approvedRule(rules.createRule);
		collection.updateRule = approvedRule(rules.updateRule);
		collection.deleteRule = approvedRule(rules.deleteRule);
		app.save(collection);
	}
}

function preventClientApproval(users) {
	const condition = '@request.body.approved:isset = false';
	if (users.createRule !== null && !users.createRule.includes('approved:isset')) {
		users.createRule = hasRuleExpression(users.createRule)
			? `(${users.createRule}) && ${condition}`
			: condition;
	}
	if (users.updateRule !== null && !users.updateRule.includes('approved:isset')) {
		users.updateRule = hasRuleExpression(users.updateRule)
			? `(${users.updateRule}) && ${condition}`
			: condition;
	}
}

function restoreUserRules(users) {
	if (users.createRule !== null) {
		users.createRule = users.createRule
			.replace(/ && @request\.body\.approved:isset = false$/, '')
			.replace(/^@request\.body\.approved:isset = false$/, '');
	}
	if (users.updateRule !== null) {
		users.updateRule = users.updateRule
			.replace(/ && @request\.body\.approved:isset = false$/, '')
			.replace(/^@request\.body\.approved:isset = false$/, '');
	}
}

migrate(
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		users.fields.add(new BoolField({ name: 'approved', required: false }));
		preventClientApproval(users);
		app.save(users);

		// Existing app administrators retain access after approval is introduced.
		for (const user of app.findRecordsByFilter('users', 'admin = true', '', 0, 0)) {
			user.set('approved', true);
			app.save(user);
		}

		// Enforce the policy at PocketBase's data boundary as well as in SvelteKit.
		// This blocks direct API calls made with an unapproved account token.
		setTenantCollectionRules(app);
	},
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		users.fields.removeByName('approved');
		restoreUserRules(users);
		app.save(users);

		for (const [collectionName, collectionRules] of Object.entries(tenantCollectionRules)) {
			const collection = app.findCollectionByNameOrId(collectionName);
			Object.assign(collection, collectionRules);
			app.save(collection);
		}
	}
);
