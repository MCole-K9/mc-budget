import { withAdminPb } from './db';

// Records can only be created for, or reassigned to, the requesting user (or their own wallets).
// Keep in sync with pb_migrations/11_owner_write_rules.js.
const ownerCreate = "@request.auth.id != '' && @request.body.user = @request.auth.id";
const keepsOwner = '(@request.body.user:isset = false || @request.body.user = @request.auth.id)';
const keepsWallet =
	'(@request.body.wallet:isset = false || @request.body.wallet.user = @request.auth.id)';
const keepsSourceWallet =
	'(@request.body.source_wallet:isset = false || @request.body.source_wallet.user = @request.auth.id)';

const tenantCollectionRules = {
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
	},
	// Keep in sync with pb_migrations/12_budget_covers.js
	budget_covers: {
		listRule: '@request.auth.id = wallet.user.id',
		viewRule: '@request.auth.id = wallet.user.id',
		createRule: '@request.auth.id = wallet.user.id && @request.auth.id = source_wallet.user.id',
		updateRule: `@request.auth.id = wallet.user.id && ${keepsWallet} && ${keepsSourceWallet}`,
		deleteRule: '@request.auth.id = wallet.user.id'
	}
};

const approvalRule = '@request.auth.approved = true';

function withApprovalRule(rule: string): string {
	return rule ? `(${approvalRule}) && (${rule})` : approvalRule;
}

/**
 * Applies the PocketBase data boundary for the current instance visibility.
 * Private instances require approval even for direct PocketBase API requests.
 */
export async function setTenantCollectionRules(isPrivateInstance: boolean): Promise<void> {
	await withAdminPb(async (pb) => {
		const collections = await Promise.all(
			Object.entries(tenantCollectionRules).map(async ([collectionName, rules]) => {
				const collection = await pb.collections.getOne(collectionName);
				const selectedRules = isPrivateInstance
					? {
							listRule: withApprovalRule(rules.listRule),
							viewRule: withApprovalRule(rules.viewRule),
							createRule: withApprovalRule(rules.createRule),
							updateRule: withApprovalRule(rules.updateRule),
							deleteRule: withApprovalRule(rules.deleteRule)
						}
					: rules;

				return { ...collection, ...selectedRules };
			})
		);

		// PocketBase applies a collection import in one transaction, preventing a partially
		// relaxed access policy if one collection configuration is rejected.
		await pb.collections.import(collections, false);
	});
}
