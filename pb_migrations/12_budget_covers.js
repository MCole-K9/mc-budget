/// <reference path="../pb_data/types.d.ts" />

// A budget cover moves an overage's budget onto an over-budget category (`category` in
// `wallet`) from another category (`source_category` in `source_wallet`, which is `wallet`
// itself for a same-wallet cover). Cross-wallet covers also move the money, through the
// transfer named by `transfer_id`. `source_wallet` is not cascade-deleted: if the source wallet
// goes, the covered side keeps its cover (and the money it received).
// Keep the rules in sync with src/lib/server/tenantAccess.ts.

const approved = '@request.auth.approved = true';
const keepsWallet =
	'(@request.body.wallet:isset = false || @request.body.wallet.user = @request.auth.id)';
const keepsSourceWallet =
	'(@request.body.source_wallet:isset = false || @request.body.source_wallet.user = @request.auth.id)';

const rules = {
	listRule: '@request.auth.id = wallet.user.id',
	viewRule: '@request.auth.id = wallet.user.id',
	createRule: '@request.auth.id = wallet.user.id && @request.auth.id = source_wallet.user.id',
	updateRule: `@request.auth.id = wallet.user.id && ${keepsWallet} && ${keepsSourceWallet}`,
	deleteRule: '@request.auth.id = wallet.user.id'
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
		const wallets = app.findCollectionByNameOrId('wallets');
		const withApproval = isPrivateInstance(app);
		const pick = (rule) => (withApproval ? approvedRule(rule) : rule);

		const covers = new Collection({
			type: 'base',
			name: 'budget_covers',
			listRule: pick(rules.listRule),
			viewRule: pick(rules.viewRule),
			createRule: pick(rules.createRule),
			updateRule: pick(rules.updateRule),
			deleteRule: pick(rules.deleteRule)
		});
		covers.fields.add(new RelationField({ name: 'wallet', required: true, collectionId: wallets.id, cascadeDelete: true, maxSelect: 1 }));
		covers.fields.add(new TextField({ name: 'category', required: true, max: 100 }));
		covers.fields.add(new NumberField({ name: 'amount', required: true, min: 0 }));
		covers.fields.add(new RelationField({ name: 'source_wallet', required: false, collectionId: wallets.id, cascadeDelete: false, maxSelect: 1 }));
		covers.fields.add(new TextField({ name: 'source_category', required: true, max: 100 }));
		covers.fields.add(new NumberField({ name: 'source_amount', required: true, min: 0 }));
		covers.fields.add(new DateField({ name: 'date', required: true }));
		covers.fields.add(new TextField({ name: 'transfer_id', required: false }));
		covers.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }));
		covers.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }));
		app.save(covers);
	},
	(app) => {
		app.delete(app.findCollectionByNameOrId('budget_covers'));
	}
);
