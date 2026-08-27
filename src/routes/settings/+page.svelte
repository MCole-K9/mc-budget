<script lang="ts">
	import {
		approveAccount,
		clearUserProviderKey,
		getAiSettings,
		getApprovedAccounts,
		getFinancialSettings,
		getPendingAccounts,
		getUserAiSettings,
		saveProviderKey,
		saveUserProviderKey,
		revokeAccount,
		setActiveProvider,
		setBaseCurrency,
		updatePrivateInstance,
		type ManagedAccount
	} from '$lib/settings.remote';
	import { AI_PROVIDERS, PROVIDER_LABELS, PROVIDER_MODELS } from '$lib/settings';
	import type { AiProvider } from '$lib/settings';
	import AuthGuard from '$lib/components/AuthGuard.svelte';

	const initial = await getAiSettings();
	const [{ baseCurrency: initBase }, userAi, initialPendingAccounts, initialApprovedAccounts] =
		await Promise.all([
			getFinancialSettings(),
			getUserAiSettings(),
			initial.isAdmin && initial.isPrivateInstance
				? getPendingAccounts()
				: Promise.resolve([] as ManagedAccount[]),
			initial.isAdmin && initial.isPrivateInstance
				? getApprovedAccounts()
				: Promise.resolve([] as ManagedAccount[])
		]);
	const isAdmin = initial.isAdmin;
	let baseCurrencyInput = $state(initBase);
	let savingBase = $state(false);
	let baseSaved = $state(false);

	let activeProvider = $state(initial.activeProvider);
	let configured = $state({ ...initial.keys });

	// Per-provider state
	let keys = $state<Record<AiProvider, string>>({ anthropic: '', openai: '', google: '' });
	let saving = $state<AiProvider | null>(null);
	let activating = $state<AiProvider | null>(null);
	let errors = $state<Record<AiProvider, string>>({ anthropic: '', openai: '', google: '' });
	let saved = $state<AiProvider | null>(null);

	async function handleSaveKey(provider: AiProvider) {
		if (!keys[provider].trim()) return;
		saving = provider;
		errors[provider] = '';
		saved = null;
		try {
			await saveProviderKey({ provider, apiKey: keys[provider].trim() });
			configured[provider] = true;
			saved = provider;
			keys[provider] = '';
			setTimeout(() => {
				if (saved === provider) saved = null;
			}, 3000);
		} catch (err) {
			errors[provider] = err instanceof Error ? err.message : 'Failed to save key';
		} finally {
			saving = null;
		}
	}

	async function handleSaveBaseCurrency() {
		if (baseCurrencyInput.trim().length !== 3) return;
		savingBase = true;
		try {
			await setBaseCurrency(baseCurrencyInput.trim().toUpperCase());
			baseSaved = true;
			setTimeout(() => {
				baseSaved = false;
			}, 3000);
		} finally {
			savingBase = false;
		}
	}

	async function handleSetActive(provider: AiProvider) {
		activating = provider;
		errors[provider] = '';
		try {
			await setActiveProvider({ provider });
			activeProvider = provider;
		} catch (err) {
			errors[provider] = err instanceof Error ? err.message : 'Failed to set provider';
		} finally {
			activating = null;
		}
	}

	// Personal API key state
	let userConfigured = $state({ ...userAi.keys });
	let userKeys = $state<Record<AiProvider, string>>({ anthropic: '', openai: '', google: '' });
	let userSaving = $state<AiProvider | null>(null);
	let userClearing = $state<AiProvider | null>(null);
	let userErrors = $state<Record<AiProvider, string>>({ anthropic: '', openai: '', google: '' });
	let userSaved = $state<AiProvider | null>(null);

	let pendingAccounts = $state<ManagedAccount[]>(initialPendingAccounts);
	let approvedAccounts = $state<ManagedAccount[]>(initialApprovedAccounts);
	let approvingAccountId = $state<string | null>(null);
	let accountToRevoke = $state<ManagedAccount | null>(null);
	let revokingAccountId = $state<string | null>(null);
	let approvalError = $state('');
	let isPrivateInstance = $state(initial.isPrivateInstance);
	let savingPrivateInstance = $state(false);
	let privateInstanceError = $state('');
	let privateInstanceSaved = $state(false);

	async function handlePrivateInstanceChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const nextValue = input.checked;
		savingPrivateInstance = true;
		privateInstanceError = '';
		privateInstanceSaved = false;

		try {
			await updatePrivateInstance(nextValue);
			isPrivateInstance = nextValue;
			if (nextValue) {
				[pendingAccounts, approvedAccounts] = await Promise.all([
					getPendingAccounts(),
					getApprovedAccounts()
				]);
			} else {
				pendingAccounts = [];
				approvedAccounts = [];
				accountToRevoke = null;
			}
			privateInstanceSaved = true;
			setTimeout(() => {
				privateInstanceSaved = false;
			}, 3000);
		} catch (err) {
			input.checked = isPrivateInstance;
			privateInstanceError =
				err instanceof Error ? err.message : 'Failed to update instance access';
		} finally {
			savingPrivateInstance = false;
		}
	}

	async function handleApproveAccount(accountId: string) {
		approvingAccountId = accountId;
		approvalError = '';
		try {
			await approveAccount(accountId);
			const approvedAccount = pendingAccounts.find((account) => account.id === accountId);
			pendingAccounts = pendingAccounts.filter((account) => account.id !== accountId);
			if (approvedAccount) approvedAccounts = [...approvedAccounts, approvedAccount];
		} catch (err) {
			approvalError = err instanceof Error ? err.message : 'Failed to approve account';
		} finally {
			approvingAccountId = null;
		}
	}

	async function handleRevokeAccount() {
		const account = accountToRevoke;
		if (!account) return;

		revokingAccountId = account.id;
		approvalError = '';
		try {
			await revokeAccount(account.id);
			approvedAccounts = approvedAccounts.filter((item) => item.id !== account.id);
			pendingAccounts = [...pendingAccounts, account].sort((a, b) =>
				a.created.localeCompare(b.created)
			);
			accountToRevoke = null;
		} catch (err) {
			approvalError = err instanceof Error ? err.message : 'Failed to revoke account access';
		} finally {
			revokingAccountId = null;
		}
	}

	async function handleSaveUserKey(provider: AiProvider) {
		if (!userKeys[provider].trim()) return;
		userSaving = provider;
		userErrors[provider] = '';
		userSaved = null;
		try {
			await saveUserProviderKey({ provider, apiKey: userKeys[provider].trim() });
			userConfigured[provider] = true;
			userSaved = provider;
			userKeys[provider] = '';
			setTimeout(() => {
				if (userSaved === provider) userSaved = null;
			}, 3000);
		} catch (err) {
			userErrors[provider] = err instanceof Error ? err.message : 'Failed to save key';
		} finally {
			userSaving = null;
		}
	}

	async function handleClearUserKey(provider: AiProvider) {
		userClearing = provider;
		userErrors[provider] = '';
		try {
			await clearUserProviderKey({ provider });
			userConfigured[provider] = false;
		} catch (err) {
			userErrors[provider] = err instanceof Error ? err.message : 'Failed to clear key';
		} finally {
			userClearing = null;
		}
	}
</script>

<svelte:head>
	<title>Settings - MC Budget</title>
</svelte:head>

<AuthGuard>
	<div class="mx-auto max-w-3xl space-y-6">
		<h1 class="text-2xl font-bold">Settings</h1>

		<div>
			<h2 class="mb-3 text-xs font-semibold tracking-widest text-base-content/40 uppercase">
				Financial Settings
			</h2>
			<p class="mb-4 text-sm text-base-content/50">
				Base currency for unified totals in reports. Exchange rates fetched from open.er-api.com
				(free, cached 1 hr).
			</p>
			<div class="flex max-w-xs items-center gap-2">
				<input
					type="text"
					maxlength="3"
					class="input-bordered input input-sm w-20 uppercase"
					bind:value={baseCurrencyInput}
					oninput={() => (baseCurrencyInput = baseCurrencyInput.toUpperCase())}
					onkeydown={(e) => e.key === 'Enter' && handleSaveBaseCurrency()}
				/>
				<button
					class="btn btn-sm btn-primary"
					disabled={baseCurrencyInput.length !== 3 || savingBase}
					onclick={handleSaveBaseCurrency}
				>
					{#if savingBase}
						<span class="loading loading-xs loading-spinner"></span>
					{:else}
						Save
					{/if}
				</button>
				{#if baseSaved}
					<span class="text-xs text-success">✓ Saved</span>
				{/if}
			</div>
		</div>

		<div>
			<h2 class="mb-3 text-xs font-semibold tracking-widest text-base-content/40 uppercase">
				Personal API Keys
			</h2>
			<p class="mb-4 text-sm text-base-content/50">
				Your own keys override the shared system keys. Values are stored per-user, server-side, and
				never sent to the browser.
			</p>

			<div class="grid gap-4 md:grid-cols-3">
				{#each AI_PROVIDERS as provider (provider)}
					{@const isSet = userConfigured[provider]}
					{@const isSaving = userSaving === provider}
					{@const isClearing = userClearing === provider}

					<div class="flex flex-col gap-3 rounded-2xl bg-base-100 p-4 shadow-sm">
						<div class="flex items-start justify-between">
							<div>
								<p class="font-semibold">{PROVIDER_LABELS[provider]}</p>
								<p class="mt-0.5 text-xs text-base-content/40">Personal key</p>
							</div>
							{#if isSet}
								<span class="badge badge-sm badge-success">Key set</span>
							{:else}
								<span class="badge badge-ghost badge-sm">Using system</span>
							{/if}
						</div>

						{#if userSaved === provider}
							<p class="text-xs text-success">✓ Key saved</p>
						{/if}
						{#if userErrors[provider]}
							<p class="text-xs text-error">{userErrors[provider]}</p>
						{/if}

						<div class="flex gap-2">
							<input
								type="password"
								class="input-bordered input input-sm min-w-0 flex-1"
								placeholder={isSet ? 'Replace key…' : 'Paste key…'}
								autocomplete="off"
								bind:value={userKeys[provider]}
								onkeydown={(e) => e.key === 'Enter' && handleSaveUserKey(provider)}
							/>
							<button
								class="btn btn-sm btn-primary"
								disabled={!userKeys[provider].trim() || isSaving}
								onclick={() => handleSaveUserKey(provider)}
							>
								{#if isSaving}
									<span class="loading loading-xs loading-spinner"></span>
								{:else}
									Save
								{/if}
							</button>
						</div>

						{#if isSet}
							<button
								class="btn w-full text-error/70 btn-ghost btn-sm hover:text-error"
								disabled={isClearing}
								onclick={() => handleClearUserKey(provider)}
							>
								{#if isClearing}
									<span class="loading loading-xs loading-spinner"></span>
								{:else}
									Remove (use system key)
								{/if}
							</button>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		{#if isAdmin}
			<div>
				<h2 class="mb-3 text-xs font-semibold tracking-widest text-base-content/40 uppercase">
					Instance access
				</h2>
				<div class="flex items-center justify-between gap-4 rounded-2xl bg-base-100 p-4 shadow-sm">
					<div>
						<p class="font-medium">Private instance</p>
						<p class="mt-1 text-sm text-base-content/50">
							{#if isPrivateInstance}
								Accounts require administrator approval before accessing MC Budget.
							{:else}
								Any authenticated account can access MC Budget.
							{/if}
						</p>
					</div>
					<input
						type="checkbox"
						class="toggle toggle-primary"
						checked={isPrivateInstance}
						disabled={savingPrivateInstance}
						onchange={handlePrivateInstanceChange}
					/>
				</div>
				{#if privateInstanceError}
					<p class="mt-2 text-sm text-error">{privateInstanceError}</p>
				{:else if privateInstanceSaved}
					<p class="mt-2 text-sm text-success">✓ Instance access updated</p>
				{/if}
			</div>

			{#if isPrivateInstance}
				<div>
					<h2 class="mb-3 text-xs font-semibold tracking-widest text-base-content/40 uppercase">
						Awaiting approval
					</h2>
					<p class="mb-4 text-sm text-base-content/50">
						Only approved accounts can access MC Budget.
					</p>

					{#if approvalError}
						<p class="mb-3 text-sm text-error">{approvalError}</p>
					{/if}

					{#if pendingAccounts.length === 0}
						<div class="rounded-2xl bg-base-100 p-4 text-sm text-base-content/50 shadow-sm">
							No accounts are awaiting approval.
						</div>
					{:else}
						<div class="overflow-x-auto rounded-2xl bg-base-100 shadow-sm">
							<table class="table">
								<thead>
									<tr>
										<th>Account</th>
										<th>Requested</th>
										<th class="text-right">Action</th>
									</tr>
								</thead>
								<tbody>
									{#each pendingAccounts as account (account.id)}
										<tr>
											<td>
												<div class="font-medium">{account.name || 'Unnamed account'}</div>
												<div class="text-sm text-base-content/50">{account.email}</div>
											</td>
											<td class="text-sm whitespace-nowrap text-base-content/50">
												{new Date(account.created).toLocaleDateString()}
											</td>
											<td class="text-right">
												<button
													class="btn btn-sm btn-primary"
													disabled={approvingAccountId === account.id}
													onclick={() => handleApproveAccount(account.id)}
												>
													{#if approvingAccountId === account.id}
														<span class="loading loading-xs loading-spinner"></span>
													{:else}
														Approve
													{/if}
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>

				<div>
					<h2 class="mb-3 text-xs font-semibold tracking-widest text-base-content/40 uppercase">
						Authorized accounts
					</h2>
					<p class="mb-4 text-sm text-base-content/50">
						Revoking access moves an account back to the approval queue without deleting its data.
					</p>

					{#if approvedAccounts.length === 0}
						<div class="rounded-2xl bg-base-100 p-4 text-sm text-base-content/50 shadow-sm">
							No non-admin accounts are currently authorized.
						</div>
					{:else}
						<div class="overflow-x-auto rounded-2xl bg-base-100 shadow-sm">
							<table class="table">
								<thead>
									<tr>
										<th>Account</th>
										<th>Joined</th>
										<th class="text-right">Action</th>
									</tr>
								</thead>
								<tbody>
									{#each approvedAccounts as account (account.id)}
										<tr>
											<td>
												<div class="font-medium">{account.name || 'Unnamed account'}</div>
												<div class="text-sm text-base-content/50">{account.email}</div>
											</td>
											<td class="text-sm whitespace-nowrap text-base-content/50">
												{new Date(account.created).toLocaleDateString()}
											</td>
											<td class="text-right">
												<button
													class="btn btn-sm btn-error"
													disabled={revokingAccountId === account.id}
													onclick={() => (accountToRevoke = account)}
												>
													Revoke access
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			{/if}

			<div>
				<h2 class="mb-3 text-xs font-semibold tracking-widest text-base-content/40 uppercase">
					AI Provider
				</h2>
				<p class="mb-4 text-sm text-base-content/50">
					Used for receipt scanning. Keys are stored server-side and never sent to the browser.
				</p>

				<div class="grid gap-4 md:grid-cols-3">
					{#each AI_PROVIDERS as provider (provider)}
						{@const isActive = activeProvider === provider}
						{@const isConfigured = configured[provider]}
						{@const isSaving = saving === provider}
						{@const isActivating = activating === provider}

						<div
							class="flex flex-col gap-3 rounded-2xl bg-base-100 p-4 shadow-sm {isActive
								? 'ring-2 ring-primary'
								: ''}"
						>
							<!-- Header -->
							<div class="flex items-start justify-between">
								<div>
									<p class="font-semibold">{PROVIDER_LABELS[provider]}</p>
									<p class="mt-0.5 text-xs text-base-content/40">{PROVIDER_MODELS[provider]}</p>
								</div>
								<div class="flex flex-col items-end gap-1">
									{#if isActive}
										<span class="badge badge-sm badge-primary">Active</span>
									{/if}
									{#if isConfigured}
										<span class="badge badge-sm badge-success">Key set</span>
									{:else}
										<span class="badge badge-ghost badge-sm">No key</span>
									{/if}
								</div>
							</div>

							{#if saved === provider}
								<p class="text-xs text-success">✓ Key saved</p>
							{/if}
							{#if errors[provider]}
								<p class="text-xs text-error">{errors[provider]}</p>
							{/if}

							<!-- Key input -->
							<div class="flex gap-2">
								<input
									type="password"
									class="input-bordered input input-sm min-w-0 flex-1"
									placeholder={isConfigured ? 'Replace key…' : 'Paste key…'}
									autocomplete="off"
									bind:value={keys[provider]}
									onkeydown={(e) => e.key === 'Enter' && handleSaveKey(provider)}
								/>
								<button
									class="btn btn-sm btn-primary"
									disabled={!keys[provider].trim() || isSaving}
									onclick={() => handleSaveKey(provider)}
								>
									{#if isSaving}
										<span class="loading loading-xs loading-spinner"></span>
									{:else}
										Save
									{/if}
								</button>
							</div>

							<!-- Set active -->
							{#if !isActive && isConfigured}
								<button
									class="btn w-full btn-ghost btn-sm"
									disabled={isActivating}
									onclick={() => handleSetActive(provider)}
								>
									{#if isActivating}
										<span class="loading loading-xs loading-spinner"></span>
									{:else}
										Use this provider
									{/if}
								</button>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</AuthGuard>

{#if accountToRevoke}
	<div class="modal-open modal" role="presentation">
		<div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="revoke-account-title">
			<h2 id="revoke-account-title" class="text-lg font-bold">Revoke account access?</h2>
			<p class="mt-2 text-sm text-base-content/70">
				{accountToRevoke.name || accountToRevoke.email} will lose access immediately. Their data will
				be kept and the account can be approved again later.
			</p>
			<div class="modal-action">
				<button
					class="btn btn-ghost"
					disabled={revokingAccountId === accountToRevoke.id}
					onclick={() => (accountToRevoke = null)}
				>
					Cancel
				</button>
				<button
					class="btn btn-error"
					disabled={revokingAccountId === accountToRevoke.id}
					onclick={handleRevokeAccount}
				>
					{#if revokingAccountId === accountToRevoke.id}
						<span class="loading loading-xs loading-spinner"></span>
					{:else}
						Revoke access
					{/if}
				</button>
			</div>
		</div>
		<button
			class="modal-backdrop"
			aria-label="Close confirmation"
			onclick={() => (accountToRevoke = null)}
		>
			Close
		</button>
	</div>
{/if}
