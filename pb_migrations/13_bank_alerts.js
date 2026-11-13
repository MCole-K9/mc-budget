/// <reference path="../pb_data/types.d.ts" />

// Bank alerts (see docs/adr/0001-bank-alert-ingestion.md):
// - parser_templates: the user's own templates for reading their bank's alerts.
// - alerts: one received alert. Parsed alerts wait as "pending" until the user confirms or ignores
//   them. Raw text is kept only for alerts no template could read ("failed"), so the user can
//   write a template for them; it is cleared when the alert is confirmed or ignored.
// - account_links: card/account last digits → wallet, to preselect the wallet on confirm.
// - transactions.source: where a transaction came from ('alert' for confirmed alerts).
// All owner-only. Keep the rules in sync with src/lib/server/tenantAccess.ts.

const approved = '@request.auth.approved = true';
const ownerCreate = "@request.auth.id != '' && @request.body.user = @request.auth.id";
const keepsOwner = '(@request.body.user:isset = false || @request.body.user = @request.auth.id)';

const ownerRules = {
	listRule: '@request.auth.id = user.id',
	viewRule: '@request.auth.id = user.id',
	createRule: ownerCreate,
	updateRule: `@request.auth.id = user.id && ${keepsOwner}`,
	deleteRule: '@request.auth.id = user.id'
};

const accountLinkRules = {
	...ownerRules,
	createRule: `${ownerCreate} && @request.body.wallet.user = @request.auth.id`,
	updateRule: `${ownerRules.updateRule} && (@request.body.wallet:isset = false || @request.body.wallet.user = @request.auth.id)`
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

function ownedCollection(app, name, rules) {
	const pick = isPrivateInstance(app) ? approvedRule : (rule) => rule;
	const users = app.findCollectionByNameOrId('users');
	const collection = new Collection({
		type: 'base',
		name,
		listRule: pick(rules.listRule),
		viewRule: pick(rules.viewRule),
		createRule: pick(rules.createRule),
		updateRule: pick(rules.updateRule),
		deleteRule: pick(rules.deleteRule)
	});
	collection.fields.add(new RelationField({ name: 'user', required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 }));
	return collection;
}

function timestamps(collection) {
	collection.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }));
	collection.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }));
}

migrate(
	(app) => {
		const wallets = app.findCollectionByNameOrId('wallets');
		const transactions = app.findCollectionByNameOrId('transactions');

		const templates = ownedCollection(app, 'parser_templates', ownerRules);
		templates.fields.add(new TextField({ name: 'name', required: true, max: 100 }));
		templates.fields.add(new TextField({ name: 'bank_id', required: true, max: 50 }));
		templates.fields.add(new JSONField({ name: 'from_domains', required: false, maxSize: 5000 }));
		templates.fields.add(new TextField({ name: 'subject_regex', required: false, max: 500 }));
		templates.fields.add(new JSONField({ name: 'fields', required: true, maxSize: 10000 }));
		templates.fields.add(new BoolField({ name: 'enabled', required: false }));
		timestamps(templates);
		app.save(templates);

		const alerts = ownedCollection(app, 'alerts', ownerRules);
		alerts.fields.add(new TextField({ name: 'channel', required: true, max: 20 }));
		alerts.fields.add(new TextField({ name: 'status', required: true, max: 20 }));
		alerts.fields.add(new TextField({ name: 'raw_text', required: false, max: 100000 }));
		alerts.fields.add(new TextField({ name: 'from_address', required: false, max: 1000 }));
		alerts.fields.add(new TextField({ name: 'subject', required: false, max: 1000 }));
		alerts.fields.add(new DateField({ name: 'received_at', required: true }));
		alerts.fields.add(new TextField({ name: 'bank_id', required: false, max: 50 }));
		alerts.fields.add(new TextField({ name: 'direction', required: false, max: 20 }));
		alerts.fields.add(new NumberField({ name: 'amount', required: false, min: 0 }));
		alerts.fields.add(new TextField({ name: 'currency', required: false, max: 3 }));
		alerts.fields.add(new TextField({ name: 'merchant', required: false, max: 500 }));
		alerts.fields.add(new TextField({ name: 'account_hint', required: false, max: 50 }));
		alerts.fields.add(new DateField({ name: 'occurred_at', required: false }));
		alerts.fields.add(new TextField({ name: 'reference', required: false, max: 200 }));
		alerts.fields.add(new TextField({ name: 'parser', required: false, max: 50 }));
		alerts.fields.add(new TextField({ name: 'confidence', required: false, max: 10 }));
		alerts.fields.add(new TextField({ name: 'dedupe_hash', required: false, max: 64 }));
		alerts.fields.add(new RelationField({ name: 'transaction', required: false, collectionId: transactions.id, cascadeDelete: false, maxSelect: 1 }));
		timestamps(alerts);
		alerts.indexes = [
			"CREATE UNIQUE INDEX idx_alerts_dedupe ON alerts (user, dedupe_hash) WHERE dedupe_hash != ''",
			'CREATE INDEX idx_alerts_status ON alerts (user, status)'
		];
		app.save(alerts);

		const links = ownedCollection(app, 'account_links', accountLinkRules);
		links.fields.add(new TextField({ name: 'bank_id', required: true, max: 50 }));
		links.fields.add(new TextField({ name: 'account_hint', required: true, max: 50 }));
		links.fields.add(new RelationField({ name: 'wallet', required: true, collectionId: wallets.id, cascadeDelete: true, maxSelect: 1 }));
		timestamps(links);
		links.indexes = [
			'CREATE UNIQUE INDEX idx_account_links_hint ON account_links (user, bank_id, account_hint)'
		];
		app.save(links);

		transactions.fields.add(new TextField({ name: 'source', required: false, max: 20 }));
		app.save(transactions);
	},
	(app) => {
		const transactions = app.findCollectionByNameOrId('transactions');
		transactions.fields.removeByName('source');
		app.save(transactions);
		for (const name of ['account_links', 'alerts', 'parser_templates']) {
			app.delete(app.findCollectionByNameOrId(name));
		}
	}
);
