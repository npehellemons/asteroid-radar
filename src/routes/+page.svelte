<script lang="ts">
	import type { NeoWsNearEarthObject } from '$lib';

	let { data } = $props();
	let neos = $derived.by(
		() => data?.data?.near_earth_objects[Object.keys(data?.data?.near_earth_objects || {})[0]] || []
	) as NeoWsNearEarthObject[];
</script>

<main>
	{#if data}
		<header>
			<h1>Near Earth Objects for {new Date().toDateString()}</h1>
		</header>

		{#if neos && neos.length > 0}
			<div class="neo-list">
				{#each neos as neo}
					<div class="neo-card">
						<h2>{neo.name}</h2>
						<div class="neo-card-content">
							<div class="neo-stats">
								<div class="neo-stat">
									<span class="stat-label">Diameter:</span>
									<span class="stat-value">
										{neo.estimated_diameter.kilometers.estimated_diameter_min.toFixed(2)} -
										{neo.estimated_diameter.kilometers.estimated_diameter_max.toFixed(2)} km
									</span>
								</div>

								<div class="neo-stat">
									<span class="stat-label">Close Approach:</span>
									<span class="stat-value">
										{neo.close_approach_data[0].close_approach_date_full}
									</span>
								</div>

								<div class="neo-stat">
									<span class="stat-label">Miss Distance:</span>
									<span class="stat-value">
										{parseFloat(
											neo.close_approach_data[0].miss_distance.kilometers
										).toLocaleString()} km
									</span>
								</div>

								<div class="neo-stat">
									<span class="stat-label">Velocity:</span>
									<span class="stat-value">
										{parseFloat(
											neo.close_approach_data[0].relative_velocity.kilometers_per_hour
										).toLocaleString()} km/h
									</span>
								</div>
							</div>

							<div
								class="hazard-indicator {neo.is_potentially_hazardous_asteroid
									? 'hazardous'
									: 'safe'}"
							>
								{neo.is_potentially_hazardous_asteroid ? 'POTENTIALLY HAZARDOUS' : 'NOT HAZARDOUS'}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<p>No near earth objects found for this date.</p>
		{/if}
	{:else}
		<div class="loading">
			<p>Loading near Earth objects data...</p>
		</div>
	{/if}
</main>

<style>
	main {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1rem;
		font-family:
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			sans-serif;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	h1 {
		font-size: 2rem;
		margin: 0;
		color: #333;
	}

	.neo-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
		gap: 1.5rem;
	}

	.neo-card {
		background: white;
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.neo-card h2 {
		background: #1a237e;
		color: white;
		margin: 0;
		padding: 1rem;
		font-size: 1.25rem;
	}

	.neo-card-content {
		padding: 1.5rem;
	}

	.neo-stats {
		margin-bottom: 1.5rem;
	}

	.neo-stat {
		margin-bottom: 0.75rem;
		display: flex;
		justify-content: space-between;
	}

	.stat-label {
		font-weight: bold;
		color: #555;
	}

	.stat-value {
		font-family: monospace;
	}

	.hazard-indicator {
		padding: 0.5rem;
		text-align: center;
		margin-bottom: 1rem;
		font-weight: bold;
		border-radius: 4px;
	}

	.hazardous {
		background-color: rgba(244, 67, 54, 0.1);
		color: #d32f2f;
		border: 1px solid rgba(244, 67, 54, 0.3);
	}

	.safe {
		background-color: rgba(76, 175, 80, 0.1);
		color: #388e3c;
		border: 1px solid rgba(76, 175, 80, 0.3);
	}

	.visualize-button {
		width: 100%;
		padding: 0.75rem;
		background: #2962ff;
		color: white;
		border: none;
		border-radius: 4px;
		font-weight: bold;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.visualize-button:hover {
		background: #0039cb;
	}

	.visualizer-container {
		margin: 0 auto;
		max-width: 100%;
	}

	.loading {
		text-align: center;
		padding: 2rem;
		font-size: 1.2rem;
		color: #555;
	}
</style>
