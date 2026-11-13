<script lang="ts">
	import type { ParsedAlert } from '$lib/alerts/engine';
	import { formatCurrency } from '$lib/utils/format';

	interface Props {
		alert: ParsedAlert;
	}

	let { alert }: Props = $props();

	const DIRECTION = {
		debit: { label: 'Money out', class: 'badge-error' },
		credit: { label: 'Money in', class: 'badge-success' },
		reversal: { label: 'Refund', class: 'badge-success' },
		declined: { label: 'Declined', class: 'badge-warning' }
	} as const;

	const direction = $derived(DIRECTION[alert.direction]);
	const when = $derived(
		new Date(alert.occurredAt).toLocaleString(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		})
	);
</script>

<div class="flex min-w-0 flex-wrap items-start justify-between gap-3">
	<div class="min-w-0">
		<p class="truncate font-semibold">{alert.merchant || 'Unknown merchant'}</p>
		<p class="mt-0.5 text-xs text-base-content/55">
			{when}
			{#if alert.accountHint}· card ****{alert.accountHint}{/if}
			· {alert.bankId}
		</p>
	</div>
	<div class="flex shrink-0 flex-col items-end gap-1">
		<span
			class={[
				'font-semibold tabular-nums',
				alert.direction === 'debit'
					? 'text-error'
					: alert.direction === 'declined'
						? ''
						: 'text-success'
			]}
		>
			{formatCurrency(alert.amount, alert.currency)}
		</span>
		<span class="flex gap-1">
			<span class={['badge badge-soft badge-xs', direction.class]}>{direction.label}</span>
			<span
				class={[
					'badge badge-xs',
					alert.confidence === 'high' ? 'badge-soft badge-info' : 'badge-ghost'
				]}
				title={alert.confidence === 'high'
					? 'Auto-forwarded from a verified bank sender'
					: 'Pasted or forwarded by hand: check the details'}
			>
				{alert.confidence === 'high' ? 'Verified' : 'Check'}
			</span>
			{#if alert.parser === 'ai'}
				<span
					class="badge badge-soft badge-xs badge-secondary"
					title="No template could read this alert, so your AI read it. Check every detail."
				>
					Read by AI
				</span>
			{/if}
		</span>
	</div>
</div>
