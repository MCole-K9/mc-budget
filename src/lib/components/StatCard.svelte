<script lang="ts">
	import type { ClassValue } from 'svelte/elements';
	import Icon, { type IconName } from './Icon.svelte';

	interface Props {
		label: string;
		value: string;
		tone?: 'neutral' | 'success' | 'error';
		icon?: IconName;
		/** Muted variant for secondary totals */
		muted?: boolean;
		class?: ClassValue;
	}

	let { label, value, tone = 'neutral', icon, muted = false, class: className }: Props = $props();

	const toneClasses = {
		neutral: { text: '', chip: 'bg-base-200 text-base-content/60' },
		success: { text: 'text-success', chip: 'bg-success/12 text-success' },
		error: { text: 'text-error', chip: 'bg-error/12 text-error' }
	} as const;
</script>

<div class={[muted ? 'rounded-box bg-base-100/60 p-4' : 'surface p-4', className]}>
	<div class="flex items-center gap-2">
		{#if icon}
			<span class={['grid size-7 place-items-center rounded-lg', toneClasses[tone].chip]}>
				<Icon name={icon} class="size-4" />
			</span>
		{/if}
		<p class="truncate eyebrow">{label}</p>
	</div>
	<p
		class={[
			'mt-2 truncate text-lg font-semibold tracking-tight tabular-nums sm:text-xl',
			toneClasses[tone].text
		]}
		title={value}
	>
		{value}
	</p>
</div>
