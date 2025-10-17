<script lang="ts">
	import type { NeoWsNearEarthObject } from '$lib';
	import earth from '$lib/assets/rotating_earth.gif';
	import { onMount } from 'svelte';

	let { neos } = $props();
	let activeNeoIndex = $state(0);
	let activeNeo = $derived(neos[activeNeoIndex]) as NeoWsNearEarthObject;

	let cometStyle = $state('');
	let animationId = $state<number | null>(null);
	let animationProgress = $state(0);
	let animationDuration = 6000;

	let flightAngle = $state(0);
	let missDistance = $state(0);
	let minVisualDistance = $state(60);
	let cometSize = $state(20);
	let cometColor = $state('rgba(255, 255, 255, 0.8)');
	let cometGlow = $state(10);
	let spaceWidth: number;
	let spaceHeight: number;

	function animateComet(timestamp: number) {
		if (!animationId) return;

		const neo = neos[activeNeoIndex];

		if (animationProgress === 0) {
			const spaceElement = document.querySelector('.space') as HTMLElement;
			if (spaceElement) {
				spaceWidth = spaceElement.offsetWidth;
				spaceHeight = spaceElement.offsetHeight;
			} else {
				spaceWidth = window.innerWidth;
				spaceHeight = window.innerHeight;
			}
		}

		// Get the NEO velocity in kilometers per second
		const velocity = parseFloat(neo.close_approach_data[0].relative_velocity.kilometers_per_second);

		const baseSpeedFactor = 0.006;
		const minSpeed = 5; // km/s
		const maxSpeed = 70; // km/s
		const normalizedVelocity = (velocity - minSpeed) / (maxSpeed - minSpeed);
		const speedFactor = baseSpeedFactor * (0.6 + normalizedVelocity * 0.8);

		animationProgress = Math.min(1, animationProgress + speedFactor);

		// Calculate position along the path
		const pathPosition = -1.5 + animationProgress * 3;

		// Calculate x and y coordinates using the flight angle
		const angleRadians = flightAngle * (Math.PI / 180);

		// Direction vector of the comet's path
		const dirX = Math.cos(angleRadians);
		const dirY = Math.sin(angleRadians);

		// Perpendicular vector for miss distance offset
		const perpX = -dirY; // Perpendicular to direction
		const perpY = dirX;

		// Get the screen scaling factor - use the smaller dimension to ensure visibility
		const screenScale = Math.min(spaceWidth, spaceHeight) * 0.8;

		// Calculate the base trajectory position (along the angle line)
		const baseX = pathPosition * screenScale * dirX;
		const baseY = pathPosition * screenScale * dirY;

		// Scale the miss distance for visual effect
		const missDistanceScaled = missDistance * 60;
		const missDistanceWithBuffer = Math.max(missDistanceScaled, minVisualDistance);

		const x = baseX + perpX * missDistanceWithBuffer;
		const y = baseY + perpY * missDistanceWithBuffer;
		cometStyle = `
			--position-x: calc(50% + ${x}px);
			--position-y: calc(50% + ${y}px);
			--radius: ${cometSize}px;
			--color: ${cometColor};
			--glow: ${cometGlow}px;
		`;

		if (animationProgress < 1) {
			animationId = requestAnimationFrame(animateComet);
		} else {
			cancelAnimationFrame(animationId);
			animationId = null;
			setTimeout(() => {
				animationProgress = 0;
				cycleNeo();
			}, 2000);
		}
	}

	function startAnimation() {
		if (animationId !== null) {
			cancelAnimationFrame(animationId);
		}
		animationProgress = 0;
		animationId = requestAnimationFrame(animateComet);
	}

	// Update comet parameters based on NEO properties
	function updateCometPath(neo = activeNeo) {
		const missDistanceKm = parseFloat(neo.close_approach_data[0].miss_distance.kilometers);
		const velocityKmS = parseFloat(
			neo.close_approach_data[0].relative_velocity.kilometers_per_second
		);

		// Earth constants
		const earthDiameterKm = 12742; // Earth's diameter in km
		const earthVisualDiameter = 90; // Earth's visual diameter in pixels
		const earthRadiusVisualized = earthVisualDiameter / 2;

		minVisualDistance = earthRadiusVisualized + 15; // Earth radius + buffer

		// Calculate a visual scaling factor that brings comets closer while preserving relative distances
		const scaledDistance = Math.log10(1 + missDistanceKm / 10000) * 0.8;

		// Update the miss distance state variable for animation
		missDistance = scaledDistance;

		// Get NEO diameter in km
		const diameter = neo.estimated_diameter.kilometers.estimated_diameter_max;

		// Calculate the relative scale: NEO diameter in pixels = (NEO km / Earth km) * Earth pixels
		// Apply a scaling factor to make small NEOs visible while keeping size relatively accurate
		const scaleFactor = 3; // Increase to make small NEOs more visible

		// Calculate true scale
		const trueScaleSize = (diameter / earthDiameterKm) * earthVisualDiameter;

		// Add logarithmic scaling for very small NEOs to ensure visibility
		let scaledSize;
		if (trueScaleSize < 5) {
			// For tiny NEOs, use logarithmic scaling to ensure visibility
			scaledSize = Math.max(3, Math.log10(1 + diameter) * 10 * scaleFactor);
		} else {
			// For larger NEOs, use more accurate scaling
			scaledSize = trueScaleSize * scaleFactor;
		}

		// Cap the maximum size for very large NEOs
		cometSize = Math.min(earthVisualDiameter * 0.7, scaledSize);

		// Get the velocity for visual effects
		const velocity = velocityKmS;
		const velocityNormalized = Math.min(velocity / 60, 1);

		// Enhanced visual effects based on NEO properties
		if (neo.is_potentially_hazardous_asteroid) {
			// Hazardous objects: fiery red-orange with higher opacity
			// Higher velocity = more yellow/white in the center (hotter)
			const greenValue = Math.floor(80 + velocityNormalized * 175);
			const blueValue = Math.floor(20 + velocityNormalized * 80);

			// Make faster objects appear "hotter" with more yellow/white
			const intenseFactor = Math.min(1, velocityNormalized * 1.5);
			const alphaBase = 0.95 + intenseFactor * 0.05;

			cometColor = `rgba(255, ${greenValue}, ${blueValue}, ${alphaBase})`;
			cometGlow = 18 + velocityNormalized * 15 + diameter * 0.8;

			// Add CSS variable for styling the custom animations
			cometStyle = `
				${cometStyle}
				--comet-core-opacity: 1;
				--comet-inner-glow-opacity: ${0.9 * intenseFactor};
				--comet-outer-glow-opacity: ${0.6 * intenseFactor};
			`;
		} else {
			// Non-hazardous: cool blue-white with subtle color variation based on size
			// Larger objects tend toward blue-white, smaller toward cyan-blue
			const sizeInfluence = Math.min(diameter / 2, 1); // Size factor (0-1)
			const redValue = Math.floor(130 + velocityNormalized * 125);
			const greenValue = Math.floor(180 + velocityNormalized * 75);
			const blueValue = Math.floor(200 + velocityNormalized * 55);

			// Add slight size-based variation
			const alphaBase = 0.85 + sizeInfluence * 0.15;

			cometColor = `rgba(${redValue}, ${greenValue}, ${blueValue}, ${alphaBase})`;
			cometGlow = 10 + velocityNormalized * 14 + diameter * 0.5;

			// Add CSS variable for styling the custom animations
			cometStyle = `
				${cometStyle}
				--comet-core-opacity: ${0.9 + sizeInfluence * 0.1};
				--comet-inner-glow-opacity: ${0.7 + velocityNormalized * 0.2};
				--comet-outer-glow-opacity: ${0.4 + velocityNormalized * 0.1};
			`;
		}
	}

	// Calculate flight angle - completely random but avoiding too shallow angles
	function calculateFlightAngle(neo: any) {
		// Generate a random angle between -70 and 70 degrees
		let randomAngle = Math.random() * 140 - 70;

		// Avoid angles that are too shallow (between -20 and 20 degrees)
		if (randomAngle > -20 && randomAngle < 20) {
			randomAngle = randomAngle >= 0 ? 20 + (randomAngle % 10) : -20 - (randomAngle % 10);
		}

		flightAngle = randomAngle;
	}

	// Cycle to the next NEO
	function cycleNeo() {
		activeNeoIndex = (activeNeoIndex + 1) % neos.length;
		calculateFlightAngle(neos[activeNeoIndex]);
		updateCometPath(neos[activeNeoIndex]);
		startAnimation();
	}

	// Format approach time
	function getApproachTime(dateTimeStr: string | undefined) {
		if (!dateTimeStr) return 'Unknown';
		const date = new Date(dateTimeStr + ' UTC');
		const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		console.log('ORIGINAL DATE:', dateTimeStr, 'FORMATTED DATE:', date.toString());
		return date.toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
			timeZone: userTimeZone
		});
	}

	let currentTime = $state(new Date());
	setInterval(() => {
		currentTime = new Date();
	}, 1000);

	let clock = $derived.by(() => {
		const now = currentTime;
		return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	});

	onMount(() => {
		if (neos && neos.length > 0) {
			calculateFlightAngle(activeNeo);
			updateCometPath(activeNeo);
			startAnimation();
		}
	});
</script>

<div class="space">
	<div class="info-container">
		<h1>
			{clock}
		</h1>
		<h2>
			{Intl.DateTimeFormat('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			}).format(new Date())}
		</h2>
	</div>
	<img src={earth} alt="" class="earth" />
	{#if activeNeo}
		<div class="neo-info">
			<h3>{activeNeo.name}</h3>
			<p>
				Diameter: ~{activeNeo.estimated_diameter.kilometers.estimated_diameter_max.toFixed(2)}km / ~{activeNeo.estimated_diameter.meters.estimated_diameter_max.toFixed(
					0
				)}m
			</p>
			<p>
				Miss distance: {parseFloat(
					activeNeo.close_approach_data[0]?.miss_distance.lunar || '0'
				).toFixed(2)} lunar distances
			</p>
			<p>
				Speed: {parseFloat(
					activeNeo.close_approach_data[0]?.relative_velocity.kilometers_per_second || '0'
				).toFixed(2)} km/s
			</p>
			<p>
				Time of approach: {getApproachTime(
					activeNeo.close_approach_data[0]?.close_approach_date_full
				)}
			</p>
			<p class={activeNeo.is_potentially_hazardous_asteroid ? 'hazard' : 'no-hazard'}>
				{activeNeo.is_potentially_hazardous_asteroid ? 'Potentially Hazardous' : 'Not Hazardous'}
			</p>
		</div>
		<div class="comet-container" style={cometStyle}>
			<span class="comet"></span>
		</div>
	{/if}
</div>

<style>
	.space {
		height: calc(100vh - var(--header-height) - var(--footer-height));
		width: 100%;
		background: radial-gradient(ellipse at center, #000000 0%, #0d1a26 100%);
		overflow: hidden;
		display: flex;
		justify-content: center;
		align-items: center;
		position: relative;
	}

	.space::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: url('$lib/assets/starfield.jpg') repeat;
		background-size: cover;
		opacity: 1;
		z-index: 0;
		filter: brightness(0.15);
	}
	.earth {
		width: 90px;
		height: 90px;
		z-index: 1;
	}
	.info-container {
		position: absolute;
		top: 50px;
		left: 50%;
		transform: translateX(-50%);
		text-align: center;
		color: white;
		z-index: 3;

		h1 {
			margin: 0 0 0.5rem;
			font-size: 1.8rem;
		}
	}
	.comet-container {
		--radius: 20px;
		--position-x: 50%;
		--position-y: 50%;
		--color: rgba(255, 255, 255, 0.8);
		--glow: 10px;
		position: absolute;
		top: var(--position-y);
		left: var(--position-x);
		transform: translate(-50%, -50%);
		z-index: 2;
		pointer-events: none;
	}

	.comet {
		--comet-core-opacity: 1;
		--comet-inner-glow-opacity: 0.8;
		--comet-outer-glow-opacity: 0.5;
		position: absolute;
		width: var(--radius);
		height: var(--radius);
		background: radial-gradient(circle, var(--color), transparent 80%);
		border-radius: 50%;
		z-index: 4;
		transform: translate(-50%, -50%);
		animation: comet-pulse 3s infinite alternate ease-in-out;
		box-shadow: 0 0 calc(var(--glow) / 2) var(--color);
	}

	/* Inner glow */
	.comet::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		width: calc(var(--radius) * 1.8);
		height: calc(var(--radius) * 1.8);
		background: radial-gradient(circle, var(--color), transparent 70%);
		border-radius: 50%;
		transform: translate(-50%, -50%);
		opacity: var(--comet-inner-glow-opacity);
		z-index: 3;
		animation: comet-glow 2s infinite alternate ease-in-out;
	}

	/* Outer glow */
	.comet::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		width: calc(var(--radius) * 3);
		height: calc(var(--radius) * 3);
		background: radial-gradient(
			circle,
			var(--color) 0%,
			rgba(255, 255, 255, 0.2) 40%,
			transparent 70%
		);
		border-radius: 50%;
		transform: translate(-50%, -50%);
		opacity: var(--comet-outer-glow-opacity);
		z-index: 2;
		animation: comet-outer-glow 4s infinite alternate ease-in-out;
		filter: blur(2px);
	}

	@keyframes comet-glow {
		0% {
			opacity: var(--comet-inner-glow-opacity);
			transform: translate(-50%, -50%) scale(0.9);
		}
		100% {
			opacity: calc(var(--comet-inner-glow-opacity) * 0.8);
			transform: translate(-50%, -50%) scale(1.1);
		}
	}

	@keyframes comet-outer-glow {
		0% {
			opacity: var(--comet-outer-glow-opacity);
			transform: translate(-50%, -50%) scale(0.95);
		}
		100% {
			opacity: calc(var(--comet-outer-glow-opacity) * 0.7);
			transform: translate(-50%, -50%) scale(1.05);
		}
	}

	@keyframes comet-pulse {
		0% {
			opacity: 0.9;
			transform: translate(-50%, -50%) scale(0.95);
		}
		100% {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1.05);
		}
	}

	.neo-info {
		position: absolute;
		bottom: 20px;
		left: 20px;
		background-color: rgba(0, 0, 0, 0.7);
		color: white;
		padding: 15px;
		border-radius: 8px;
		max-width: 300px;
		z-index: 3;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.neo-info h3 {
		margin: 0 0 10px 0;
		color: #70b7f2;
	}

	.neo-info p {
		margin: 5px 0;
		font-size: 0.9rem;
	}

	.hazard {
		color: #ff9966;
	}
	.no-hazard {
		color: #66ffcc;
	}
</style>
