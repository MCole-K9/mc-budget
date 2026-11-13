/// <reference path="../pb_data/types.d.ts" />

// alert_inboxes: one forward address per user (`<token>@<INBOUND_EMAIL_DOMAIN>`). The token is
// random and secret: whoever knows the address can add Pending alerts to that user. The user can
// turn the address off or get a new token. confirm_* holds the last "confirm forwarding" mail a
// mail provider sent (Gmail, Outlook, ...) so Settings can show its link.
// Owner-only. Keep the rules in sync with src/lib/server/tenantAccess.ts.

const approved = '@request.auth.approved = true';
const ownerCreate = "@request.auth.id != '' && @request.body.user = @request.auth.id";
const keepsOwner = '(@request.body.user:isset = false || @request.body.user = @request.auth.id)';

const rules = {
	listRule: '@request.auth.id = user.id',
	viewRule: '@request.auth.id = user.id',
	createRule: ownerCreate,
	updateRule: `@request.auth.id = user.id && ${keepsOwner}`,
	deleteRule: '@request.auth.id = user.id'
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

migrate(
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		const pick = isPrivateInstance(app) ? approvedRule : (rule) => rule;
		const inboxes = new Collection({
			type: 'base',
			name: 'alert_inboxes',
			listRule: pick(rules.listRule),
			viewRule: pick(rules.viewRule),
			createRule: pick(rules.createRule),
			updateRule: pick(rules.updateRule),
			deleteRule: pick(rules.deleteRule)
		});
		inboxes.fields.add(new RelationField({ name: 'user', required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 }));
		inboxes.fields.add(new TextField({ name: 'token', required: true, min: 24, max: 64, pattern: '^[a-z2-7]+$' }));
		inboxes.fields.add(new BoolField({ name: 'enabled', required: false }));
		inboxes.fields.add(new TextField({ name: 'confirm_text', required: false, max: 4000 }));
		inboxes.fields.add(new TextField({ name: 'confirm_link', required: false, max: 1000 }));
		inboxes.fields.add(new DateField({ name: 'confirm_at', required: false }));
		inboxes.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }));
		inboxes.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }));
		inboxes.indexes = [
			'CREATE UNIQUE INDEX idx_alert_inboxes_user ON alert_inboxes (user)',
			'CREATE UNIQUE INDEX idx_alert_inboxes_token ON alert_inboxes (token)'
		];
		app.save(inboxes);
	},
	(app) => {
		app.delete(app.findCollectionByNameOrId('alert_inboxes'));
	}
);
