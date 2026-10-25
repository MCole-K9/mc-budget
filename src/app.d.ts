import type PocketBase, { RecordModel } from 'pocketbase';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			pb: PocketBase;
			user: RecordModel | null;
		}
		// interface PageData {}
		interface PageState {
			presetId?: string;
		}
		// interface Platform {}
	}
}

export {};
