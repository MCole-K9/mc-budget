<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Icon, { type IconName } from './Icon.svelte';

	interface Props extends HTMLButtonAttributes {
		variant?:
			| 'primary'
			| 'secondary'
			| 'accent'
			| 'neutral'
			| 'ghost'
			| 'soft'
			| 'link'
			| 'error'
			| 'success';
		size?: 'xs' | 'sm' | 'md' | 'lg';
		outline?: boolean;
		loading?: boolean;
		/** Leading icon */
		icon?: IconName;
		/**
		 * Render as a link styled like a button (pass an already-resolved path).
		 * While disabled or loading it renders as a disabled button, since links can't be disabled.
		 */
		href?: string;
		children: Snippet;
		class?: ClassValue;
	}

	let {
		variant = 'primary',
		size = 'md',
		outline = false,
		loading = false,
		icon,
		href,
		children,
		class: className,
		disabled,
		...rest
	}: Props = $props();

	const variantClasses = {
		primary: 'btn-primary',
		secondary: 'btn-secondary',
		accent: 'btn-accent',
		neutral: 'btn-neutral',
		ghost: 'btn-ghost',
		soft: 'btn-soft',
		link: 'btn-link',
		error: 'btn-error',
		success: 'btn-success'
	} as const;

	const variantClass = $derived(variantClasses[variant]);

	const sizeClasses = {
		xs: 'btn-xs',
		sm: 'btn-sm',
		md: '',
		lg: 'btn-lg'
	} as const;

	const sizeClass = $derived(sizeClasses[size]);
	const iconSize = $derived(size === 'xs' || size === 'sm' ? 'size-4' : 'size-5');
	const classes = $derived(['btn', variantClass, sizeClass, outline && 'btn-outline', className]);
	const inactive = $derived(!!disabled || loading);
</script>

{#snippet content()}
	{#if loading}
		<span class="loading loading-sm loading-spinner"></span>
	{:else if icon}
		<Icon name={icon} class={iconSize} />
	{/if}
	{@render children()}
{/snippet}

{#if href && !inactive}
	<!-- Only attributes that mean the same on a link are forwarded; button-only ones don't apply -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass resolved paths -->
	<a {href} class={classes} id={rest.id} title={rest.title} aria-label={rest['aria-label']}>
		{@render content()}
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else}
	<button class={classes} disabled={inactive} {...rest}>
		{@render content()}
	</button>
{/if}
