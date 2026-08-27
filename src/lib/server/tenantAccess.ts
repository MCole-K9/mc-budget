import { withAdminPb } from './db';

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
