<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'link' | 'error' | 'success';
		size?: 'xs' | 'sm' | 'md' | 'lg';
		outline?: boolean;
		loading?: boolean;
		children: Snippet;
	}

	let {
		variant = 'primary',
		size = 'md',
		outline = false,
		loading = false,
		children,
		class: className = '',
		disabled,
		...rest
	}: Props = $props();

	const variantClasses: Record<string, string> = {
		primary: 'btn-primary',
		secondary: 'btn-secondary',
		accent: 'btn-accent',
		ghost: 'btn-ghost',
		link: 'btn-link',
		error: 'btn-error',
		success: 'btn-success'
	};

	const sizeClasses: Record<string, string> = {
		xs: 'btn-xs',
		sm: 'btn-sm',
		md: '',
		lg: 'btn-lg'
	};
</script>

<button
	class="btn {variantClasses[variant]} {sizeClasses[size]} {outline ? 'btn-outline' : ''} {className}"
	disabled={disabled || loading}
	{...rest}
>
	{#if loading}
		<span class="loading loading-spinner"></span>
	{/if}
	{@render children()}
</button>
