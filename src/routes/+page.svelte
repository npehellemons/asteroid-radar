<script lang="ts">
	import type { NeoWsNearEarthObject } from '$lib';
	import NeoVisualizer from '$lib/components/NeoVisualizer.svelte';

	let { data } = $props();
	let neos = $derived.by(
		() => data?.data?.near_earth_objects[Object.keys(data?.data?.near_earth_objects || {})[0]] || []
	) as NeoWsNearEarthObject[];
</script>

{#if data}
	{#if neos && neos.length > 0}
		<NeoVisualizer {neos} />
	{:else}
		<p>No near earth objects found for this date.</p>
	{/if}
{:else}
	<div class="loading">
		<p>Loading near Earth objects data...</p>
	</div>
{/if}

<style>
	.loading {
		font-size: 1.5rem;
	}
</style>
