<script lang="ts">
	import type { ChartConfiguration } from 'chart.js';
	import type { ClassValue } from 'svelte/elements';
	import { theme } from '$lib/stores/theme.svelte';

	interface Props {
		config: ChartConfiguration;
		class?: ClassValue;
	}

	let { config, class: className }: Props = $props();
	let canvas = $state<HTMLCanvasElement | undefined>(undefined);

	// Read a theme color from the CSS custom properties daisyUI sets on <html>
	function cssColor(name: string, alpha = 1): string {
		const probe = document.createElement('span');
		probe.style.color = `color-mix(in oklab, var(${name}) ${alpha * 100}%, transparent)`;
		document.body.appendChild(probe);
		const value = getComputedStyle(probe).color;
		probe.remove();
		return value;
	}

	$effect(() => {
		// Re-create the chart when the theme changes so text and gridlines stay legible
		void theme.current;
		if (!canvas) return;
		let chart: import('chart.js').Chart | undefined;
		let cancelled = false;
		import('chart.js/auto').then(({ Chart }) => {
			if (cancelled || !canvas) return;
			Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
			Chart.defaults.color = cssColor('--color-base-content', 0.6);
			Chart.defaults.borderColor = cssColor('--color-base-content', 0.08);
			chart = new Chart(canvas, config);
		});
		return () => {
			cancelled = true;
			chart?.destroy();
		};
	});
</script>

<canvas bind:this={canvas} class={className}></canvas>
