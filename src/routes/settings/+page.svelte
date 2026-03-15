<script lang="ts">
	import { getAiSettings, saveProviderKey, setActiveProvider, getFinancialSettings, setBaseCurrency, getUserAiSettings, saveUserProviderKey, clearUserProviderKey } from '$lib/settings.remote';
	import { AI_PROVIDERS, PROVIDER_LABELS, PROVIDER_MODELS } from '$lib/settings';
	import type { AiProvider } from '$lib/settings';
	import AuthGuard from '$lib/components/AuthGuard.svelte';

	const [initial, { baseCurrency: initBase }, userAi] = await Promise.all([getAiSettings(), getFinancialSettings(), getUserAiSettings()]);
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
			setTimeout(() => { if (saved === provider) saved = null; }, 3000);
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
			setTimeout(() => { baseSaved = false; }, 3000);
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
			setTimeout(() => { if (userSaved === provider) userSaved = null; }, 3000);
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
	{#snippet children()}
		<div class="max-w-3xl mx-auto space-y-6">
			<h1 class="text-2xl font-bold">Settings</h1>

			<div>
				<h2 class="text-xs font-semibold text-base-content/40 uppercase tracking-widest mb-3">
					Financial Settings
				</h2>
				<p class="text-sm text-base-content/50 mb-4">
					Base currency for unified totals in reports. Exchange rates fetched from open.er-api.com (free, cached 1 hr).
				</p>
				<div class="flex items-center gap-2 max-w-xs">
					<input
						type="text"
						maxlength="3"
						class="input input-bordered input-sm w-20 uppercase"
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
							<span class="loading loading-spinner loading-xs"></span>
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
			<h2 class="text-xs font-semibold text-base-content/40 uppercase tracking-widest mb-3">
				Personal API Keys
			</h2>
			<p class="text-sm text-base-content/50 mb-4">
				Your own keys override the shared system keys. Values are stored per-user, server-side, and never sent to the browser.
			</p>

			<div class="grid gap-4 md:grid-cols-3">
				{#each AI_PROVIDERS as provider (provider)}
					{@const isSet = userConfigured[provider]}
					{@const isSaving = userSaving === provider}
					{@const isClearing = userClearing === provider}

					<div class="bg-base-100 rounded-2xl shadow-sm p-4 flex flex-col gap-3">
						<div class="flex items-start justify-between">
							<div>
								<p class="font-semibold">{PROVIDER_LABELS[provider]}</p>
								<p class="text-xs text-base-content/40 mt-0.5">Personal key</p>
							</div>
							{#if isSet}
								<span class="badge badge-success badge-sm">Key set</span>
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
								class="input input-bordered input-sm flex-1 min-w-0"
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
									<span class="loading loading-spinner loading-xs"></span>
								{:else}
									Save
								{/if}
							</button>
						</div>

						{#if isSet}
							<button
								class="btn btn-sm btn-ghost w-full text-error/70 hover:text-error"
								disabled={isClearing}
								onclick={() => handleClearUserKey(provider)}
							>
								{#if isClearing}
									<span class="loading loading-spinner loading-xs"></span>
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
				<h2 class="text-xs font-semibold text-base-content/40 uppercase tracking-widest mb-3">
					AI Provider
				</h2>
				<p class="text-sm text-base-content/50 mb-4">
					Used for receipt scanning. Keys are stored server-side and never sent to the browser.
				</p>

				<div class="grid gap-4 md:grid-cols-3">
					{#each AI_PROVIDERS as provider (provider)}
						{@const isActive = activeProvider === provider}
						{@const isConfigured = configured[provider]}
						{@const isSaving = saving === provider}
						{@const isActivating = activating === provider}

						<div
							class="bg-base-100 rounded-2xl shadow-sm p-4 flex flex-col gap-3 {isActive
								? 'ring-2 ring-primary'
								: ''}"
						>
							<!-- Header -->
							<div class="flex items-start justify-between">
								<div>
									<p class="font-semibold">{PROVIDER_LABELS[provider]}</p>
									<p class="text-xs text-base-content/40 mt-0.5">{PROVIDER_MODELS[provider]}</p>
								</div>
								<div class="flex flex-col items-end gap-1">
									{#if isActive}
										<span class="badge badge-primary badge-sm">Active</span>
									{/if}
									{#if isConfigured}
										<span class="badge badge-success badge-sm">Key set</span>
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
									class="input input-bordered input-sm flex-1 min-w-0"
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
										<span class="loading loading-spinner loading-xs"></span>
									{:else}
										Save
									{/if}
								</button>
							</div>

							<!-- Set active -->
							{#if !isActive && isConfigured}
								<button
									class="btn btn-sm btn-ghost w-full"
									disabled={isActivating}
									onclick={() => handleSetActive(provider)}
								>
									{#if isActivating}
										<span class="loading loading-spinner loading-xs"></span>
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
	{/snippet}
</AuthGuard>
