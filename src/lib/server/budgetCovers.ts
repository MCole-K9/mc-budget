import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';
import { deleteTransfer } from './transfers';

/**
 * Deletes a transfer and the covers it funded. The covers go first so none is left shifting
 * budget with no money behind it; if the transfer can't be deleted, they are recreated.
 * Returns the ids of the wallets whose balances changed.
 */
export async function deleteTransferWithCovers(pb: PocketBase, transferId: string): Promise<string[]> {
	const covers = await pb.collection('budget_covers').getFullList({
		filter: `transfer_id = "${transferId}"`,
		requestKey: null
	});
	const deleted: RecordModel[] = [];

	try {
		for (const cover of covers) {
			await pb.collection('budget_covers').delete(cover.id, { requestKey: null });
			deleted.push(cover);
		}
		return await deleteTransfer(pb, transferId);
	} catch (error) {
		for (const cover of deleted) {
			try {
				await pb.collection('budget_covers').create({
					wallet: cover.wallet,
					category: cover.category,
					amount: cover.amount,
					source_wallet: cover.source_wallet,
					source_category: cover.source_category,
					source_amount: cover.source_amount,
					date: cover.date,
					transfer_id: cover.transfer_id
				}, { requestKey: null });
			} catch {
				throw new Error('Delete failed and a budget cover could not be restored.');
			}
		}
		throw error;
	}
}
