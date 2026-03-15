<script lang="ts">
	import type { ChartConfiguration } from 'chart.js';
	import type { ClassValue } from 'svelte/elements';

	interface Props {
		config: ChartConfiguration;
		class?: ClassValue;
	}

	let { config, class: className }: Props = $props();
	let canvas = $state<HTMLCanvasElement | undefined>(undefined);

	$effect(() => {
		if (!canvas) return;
		let chart: import('chart.js').Chart | undefined;
		import('chart.js/auto').then(({ Chart }) => {
			if (canvas) chart = new Chart(canvas, config);
		});
		return () => chart?.destroy();
	});
</script>

<canvas bind:this={canvas} class={className}></canvas>
