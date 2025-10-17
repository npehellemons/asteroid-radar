<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<title>Asteroid Radar - Near Earth Object Tracker</title>
	<link rel="icon" href={favicon} />
	<meta name="description" content="Track and visualize near earth objects in real time" />
</svelte:head>

<div class="app">
	<header class="main-header">
		<div class="header-content">
			<div class="logo">
				<img src={favicon} alt="Asteroid Radar logo" width="32" height="32" />
				<span>Asteroid Radar</span>
			</div>
			<p class="tagline">Near Earth Object Visualization</p>
		</div>
	</header>

	<main>
		{@render children?.()}
	</main>

	<footer>
		<p>
			Data provided by <a href="https://api.nasa.gov/" target="_blank" rel="noreferrer">NASA API</a>
			| NEO Visualizations are simplified models and not to scale
		</p>
		<p>© {new Date().getFullYear()} Asteroid Radar</p>
	</footer>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family:
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			sans-serif;
		background-color: #f5f5f5;
		color: #333;
	}

	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	.main-header {
		background: linear-gradient(135deg, #1a237e 0%, #283593 100%);
		color: white;
		padding: 1rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.header-content {
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.5rem;
		font-weight: bold;
	}

	.tagline {
		font-style: italic;
		opacity: 0.8;
		margin: 0;
	}

	main {
		flex: 1;
	}

	footer {
		background: #1a237e;
		color: rgba(255, 255, 255, 0.8);
		text-align: center;
		padding: 1.5rem;
		margin-top: 2rem;
	}

	footer a {
		color: white;
		text-decoration: none;
	}

	footer a:hover {
		text-decoration: underline;
	}
</style>
