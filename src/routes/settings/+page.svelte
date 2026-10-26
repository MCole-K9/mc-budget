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
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';

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

{#snippet sectionHeading(icon: IconName, title: string, description: string)}
	<div class="mb-4 flex items-start gap-3">
		<span class="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
			<Icon name={icon} class="size-[18px]" />
		</span>
		<div>
			<h2 class="font-semibold">{title}</h2>
			<p class="mt-0.5 text-sm text-base-content/55">{description}</p>
		</div>
	</div>
{/snippet}

{#snippet savedNote(text: string)}
	<span class="flex items-center gap-1 text-xs font-medium text-success">
		<Icon name="check" class="size-3.5" />
		{text}
	</span>
{/snippet}

{#snippet accountCell(account: ManagedAccount)}
	<div class="flex items-center gap-3">
		<span
			class="grid size-8 shrink-0 place-items-center rounded-full bg-base-200 text-xs font-semibold"
		>
			{(account.name || account.email || '?').charAt(0).toUpperCase()}
		</span>
		<div class="min-w-0">
			<div class="truncate font-medium">{account.name || 'Unnamed account'}</div>
			<div class="truncate text-xs text-base-content/50">{account.email}</div>
		</div>
	</div>
{/snippet}

<AuthGuard>
	<PageHeader title="Settings" subtitle="Currency, AI keys and who can use this instance." />

	<div class="space-y-6">
		<!-- Financial -->
		<section class="surface p-5 sm:p-6">
			{@render sectionHeading(
				'globe',
				'Base currency',
				'Used to combine totals in reports. Exchange rates come from open.er-api.com (free, cached for 1 hour).'
			)}
			<div class="flex items-center gap-2">
				<input
					type="text"
					maxlength="3"
					class="input w-24 font-semibold tracking-widest uppercase"
					aria-label="Base currency code"
					bind:value={baseCurrencyInput}
					oninput={() => (baseCurrencyInput = baseCurrencyInput.toUpperCase())}
					onkeydown={(e) => e.key === 'Enter' && handleSaveBaseCurrency()}
				/>
				<Button
					disabled={baseCurrencyInput.length !== 3}
					loading={savingBase}
					onclick={handleSaveBaseCurrency}
				>
					Save
				</Button>
				{#if baseSaved}
					{@render savedNote('Saved')}
				{/if}
			</div>
		</section>

		<!-- Personal keys -->
		<section class="surface p-5 sm:p-6">
			{@render sectionHeading(
				'key',
				'Personal API keys',
				'Your own keys override the shared system keys. They are stored per user on the server and never sent to the browser.'
			)}

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
				{#each AI_PROVIDERS as provider (provider)}
					{@const isSet = userConfigured[provider]}
					{@const isSaving = userSaving === provider}
					{@const isClearing = userClearing === provider}

					<div class="flex flex-col gap-3 rounded-box border border-base-300/70 p-4">
						<div class="flex items-start justify-between gap-2">
							<p class="font-semibold">{PROVIDER_LABELS[provider]}</p>
							{#if isSet}
								<span class="badge badge-soft badge-sm whitespace-nowrap badge-success">Key set</span>
							{:else}
								<span class="badge badge-ghost badge-sm whitespace-nowrap">Using system</span>
							{/if}
						</div>

						{#if userSaved === provider}
							{@render savedNote('Key saved')}
						{/if}
						{#if userErrors[provider]}
							<p class="text-xs text-error">{userErrors[provider]}</p>
						{/if}

						<div class="mt-auto flex gap-2">
							<input
								type="password"
								class="input input-sm min-w-0 flex-1"
								placeholder={isSet ? 'Replace key…' : 'Paste key…'}
								aria-label="{PROVIDER_LABELS[provider]} personal API key"
								autocomplete="off"
								bind:value={userKeys[provider]}
								onkeydown={(e) => e.key === 'Enter' && handleSaveUserKey(provider)}
							/>
							<Button
								size="sm"
								disabled={!userKeys[provider].trim()}
								loading={isSaving}
								onclick={() => handleSaveUserKey(provider)}
							>
								Save
							</Button>
						</div>

						{#if isSet}
							<Button
								variant="ghost"
								size="sm"
								class="w-full text-error"
								loading={isClearing}
								onclick={() => handleClearUserKey(provider)}
							>
								Remove (use system key)
							</Button>
						{/if}
					</div>
				{/each}
			</div>
		</section>

		{#if isAdmin}
			<div class="flex items-center gap-3 pt-4">
				<span class="eyebrow">Administration</span>
				<div class="h-px flex-1 bg-base-300/70"></div>
			</div>

			<!-- Instance access -->
			<section class="surface p-5 sm:p-6">
				<div class="flex items-start justify-between gap-4">
					{@render sectionHeading(
						'shield',
						'Private instance',
						isPrivateInstance
							? 'Accounts need administrator approval before they can use MC Budget.'
							: 'Any authenticated account can use MC Budget.'
					)}
					<input
						type="checkbox"
						class="toggle mt-1 toggle-primary"
						aria-label="Private instance"
						checked={isPrivateInstance}
						disabled={savingPrivateInstance}
						onchange={handlePrivateInstanceChange}
					/>
				</div>
				{#if privateInstanceError}
					<p class="text-sm text-error">{privateInstanceError}</p>
				{:else if privateInstanceSaved}
					{@render savedNote('Instance access updated')}
				{/if}
			</section>

			{#if isPrivateInstance}
				<!-- Accounts -->
				<section class="surface p-5 sm:p-6">
					{@render sectionHeading(
						'users',
						'Accounts',
						'Only approved accounts can use MC Budget. Revoking access moves an account back to the queue without deleting its data.'
					)}

					{#if approvalError}
						<Alert type="error" class="mb-4">{approvalError}</Alert>
					{/if}

					<h3 class="mb-2 flex items-center gap-2 text-sm font-semibold">
						Awaiting approval
						{#if pendingAccounts.length > 0}
							<span class="badge badge-soft badge-sm badge-warning">{pendingAccounts.length}</span>
						{/if}
					</h3>
					{#if pendingAccounts.length === 0}
						<p class="mb-6 rounded-field bg-base-200/60 px-4 py-3 text-sm text-base-content/55">
							No accounts are awaiting approval.
						</p>
					{:else}
						<div class="mb-6 overflow-x-auto rounded-box border border-base-300/70">
							<table class="table">
								<thead>
									<tr>
										<th>Account</th>
										<th>Requested</th>
										<th class="text-right"><span class="sr-only">Action</span></th>
									</tr>
								</thead>
								<tbody>
									{#each pendingAccounts as account (account.id)}
										<tr>
											<td>{@render accountCell(account)}</td>
											<td class="text-sm whitespace-nowrap text-base-content/55">
												{new Date(account.created).toLocaleDateString()}
											</td>
											<td class="text-right">
												<Button
													size="sm"
													icon="check"
													loading={approvingAccountId === account.id}
													onclick={() => handleApproveAccount(account.id)}
												>
													Approve
												</Button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}

					<h3 class="mb-2 text-sm font-semibold">Authorized</h3>
					{#if approvedAccounts.length === 0}
						<p class="rounded-field bg-base-200/60 px-4 py-3 text-sm text-base-content/55">
							No non-admin accounts are currently authorized.
						</p>
					{:else}
						<div class="overflow-x-auto rounded-box border border-base-300/70">
							<table class="table">
								<thead>
									<tr>
										<th>Account</th>
										<th>Joined</th>
										<th class="text-right"><span class="sr-only">Action</span></th>
									</tr>
								</thead>
								<tbody>
									{#each approvedAccounts as account (account.id)}
										<tr>
											<td>{@render accountCell(account)}</td>
											<td class="text-sm whitespace-nowrap text-base-content/55">
												{new Date(account.created).toLocaleDateString()}
											</td>
											<td class="text-right">
												<Button
													size="sm"
													variant="ghost"
													class="text-error"
													disabled={revokingAccountId === account.id}
													onclick={() => (accountToRevoke = account)}
												>
													Revoke
												</Button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</section>
			{/if}

			<!-- AI provider -->
			<section class="surface p-5 sm:p-6">
				{@render sectionHeading(
					'sparkles',
					'AI provider',
					'Shared system keys used for receipt scanning. Keys are stored on the server and never sent to the browser.'
				)}

				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
					{#each AI_PROVIDERS as provider (provider)}
						{@const isActive = activeProvider === provider}
						{@const isConfigured = configured[provider]}
						{@const isSaving = saving === provider}
						{@const isActivating = activating === provider}

						<div
							class={[
								'flex flex-col gap-3 rounded-box border p-4',
								isActive ? 'border-primary ring-2 ring-primary/15' : 'border-base-300/70'
							]}
						>
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0">
									<p class="font-semibold">{PROVIDER_LABELS[provider]}</p>
									<p class="mt-0.5 truncate text-xs text-base-content/50">
										{PROVIDER_MODELS[provider]}
									</p>
								</div>
								<div class="flex flex-col items-end gap-1">
									{#if isActive}
										<span class="badge badge-sm badge-primary">Active</span>
									{/if}
									{#if isConfigured}
										<span class="badge badge-soft badge-sm whitespace-nowrap badge-success">Key set</span>
									{:else}
										<span class="badge badge-ghost badge-sm">No key</span>
									{/if}
								</div>
							</div>

							{#if saved === provider}
								{@render savedNote('Key saved')}
							{/if}
							{#if errors[provider]}
								<p class="text-xs text-error">{errors[provider]}</p>
							{/if}

							<div class="mt-auto flex gap-2">
								<input
									type="password"
									class="input input-sm min-w-0 flex-1"
									placeholder={isConfigured ? 'Replace key…' : 'Paste key…'}
									aria-label="{PROVIDER_LABELS[provider]} system API key"
									autocomplete="off"
									bind:value={keys[provider]}
									onkeydown={(e) => e.key === 'Enter' && handleSaveKey(provider)}
								/>
								<Button
									size="sm"
									disabled={!keys[provider].trim()}
									loading={isSaving}
									onclick={() => handleSaveKey(provider)}
								>
									Save
								</Button>
							</div>

							{#if !isActive && isConfigured}
								<Button
									variant="soft"
									size="sm"
									class="w-full"
									loading={isActivating}
									onclick={() => handleSetActive(provider)}
								>
									Use this provider
								</Button>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/if}
	</div>
</AuthGuard>

<Modal
	open={!!accountToRevoke}
	title="Revoke account access?"
	onclose={() => {
		if (!revokingAccountId) accountToRevoke = null;
	}}
>
	<p class="text-sm text-base-content/70">
		{accountToRevoke?.name || accountToRevoke?.email} will lose access immediately. Their data will be
		kept and the account can be approved again later.
	</p>
	{#snippet actions()}
		<Button
			variant="ghost"
			disabled={!!revokingAccountId}
			onclick={() => (accountToRevoke = null)}
		>
			Cancel
		</Button>
		<Button variant="error" loading={!!revokingAccountId} onclick={handleRevokeAccount}>
			Revoke access
		</Button>
	{/snippet}
</Modal>
