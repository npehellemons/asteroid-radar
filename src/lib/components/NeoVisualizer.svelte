<script lang="ts">
	import type { NeoWsNearEarthObject } from '$lib';
	import earth from '$lib/assets/rotating_earth.gif';
	import { onMount } from 'svelte';
	import { isFullScreen } from '$lib/stores/fullscreen';
	import enterFullscreen from '$lib/assets/fullscreen-icon.png';
	import exitFullscreen from '$lib/assets/exit-fullscreen-icon.png';

	// Simple class to track NEO animation status
	class NeoTracker {
		// Map to track which NEOs have already been animated
		private animatedNeos = new Map<string, boolean>();

		// Mark a NEO as animated
		markAnimated(neoId: string): void {
			this.animatedNeos.set(neoId, true);
		}

		// Check if a NEO has already been animated
		hasBeenAnimated(neoId: string): boolean {
			return this.animatedNeos.has(neoId) && this.animatedNeos.get(neoId) === true;
		}

		// Reset tracking state for all NEOs
		reset(): void {
			this.animatedNeos.clear();
		}
	}

	// Tracking status constants
	const TrackingStatus = {
		UPCOMING: 'upcoming',
		PASSING: 'passing',
		PASSED: 'passed'
	};

	let { neos } = $props();
	let activeNeoIndex = $state(0);
	let activeNeo = $derived(neos[activeNeoIndex]) as NeoWsNearEarthObject;

	// Create tracker instance for managing NEO state
	const tracker = new NeoTracker();

	// Function to safely get stored mode from localStorage
	function getStoredMode(): 'daily' | 'live' {
		if (typeof localStorage !== 'undefined') {
			const storedMode = localStorage.getItem('neoVisualizerMode');
			if (storedMode === 'daily' || storedMode === 'live') {
				return storedMode;
			}
		}
		return 'daily'; // Default mode
	}

	// Store active timeouts so we can track them
	let activeTimeouts: number[] = [];

	// Function to clear all active timeouts
	function clearAllTimeouts() {
		if (typeof window !== 'undefined') {
			activeTimeouts.forEach((id) => clearTimeout(id));
			activeTimeouts = [];
		}
	}

	// Function to track timeouts
	function trackTimeout(handler: TimerHandler, timeout?: number, ...args: any[]): number {
		const id = setTimeout(handler, timeout, ...args);
		activeTimeouts.push(id);
		return id;
	}

	// Mode toggle - 'daily' (cycle through all NEOs) or 'live' (show next upcoming)
	// Initialize from localStorage if available
	let mode = $state<'daily' | 'live'>(getStoredMode());

	// Animation and visualization state
	let neoStyle = $state('');
	let animationId = $state<number | null>(null);
	let animationProgress = $state(0);
	let animationDuration = 4000; // Animation duration in milliseconds
	let isAnimationPlaying = $state(false); // Flag to prevent interruption

	// Flag to track if we're currently in a mode transition
	let isTransitioning = $state(false);

	let flightAngle = $state(0);
	let missDistance = $state(0);
	let minVisualDistance = $state(60);
	let neoSize = $state(20);
	let neoColor = $state('rgba(255, 255, 255, 0.8)');
	let neoGlow = $state(10);
	let spaceWidth: number;
	let spaceHeight: number;

	function animateneo(timestamp: number) {
		if (!animationId) return;

		const neo = neos[activeNeoIndex];

		if (animationProgress === 0) {
			// Reset the space dimensions on each animation start
			const spaceElement = document.querySelector('.space') as HTMLElement;
			if (spaceElement) {
				spaceWidth = spaceElement.offsetWidth;
				spaceHeight = spaceElement.offsetHeight;
			} else {
				spaceWidth = window.innerWidth;
				spaceHeight = window.innerHeight;
			}

			// Ensure we recalculate the flight angle and path for each new NEO animation
			// This prevents issues with the second NEO not animating correctly
			calculateFlightAngle(neo);
			updateneoPath(neo);
		}

		// Get the NEO velocity in kilometers per second
		const velocity = parseFloat(neo.close_approach_data[0].relative_velocity.kilometers_per_second);

		// Set a consistent animation speed to ensure the animation always completes
		// Use a fixed minimum speed but still let faster NEOs move faster
		const baseSpeedFactor = 0.01; // Slightly increased for smoother animations
		const minSpeed = 5; // km/s
		const maxSpeed = 70; // km/s
		const normalizedVelocity = (velocity - minSpeed) / (maxSpeed - minSpeed);

		// Make sure the animation is slow enough to be visible but fast enough to complete
		// If we're in live mode, check if another NEO is approaching soon
		let speedBoost = 1.0;
		if (mode === 'live' && findNextUpcomingNeoSoon()) {
			// If another NEO is approaching soon, speed up this animation
			speedBoost = 1.5;
		}
		const speedFactor = baseSpeedFactor * (0.8 + normalizedVelocity * 0.4) * speedBoost;

		animationProgress = Math.min(1, animationProgress + speedFactor);

		// Calculate position along the path
		const pathPosition = -1.5 + animationProgress * 3;

		// Calculate x and y coordinates using the flight angle
		const angleRadians = flightAngle * (Math.PI / 180);

		// Direction vector of the neo's path
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
		neoStyle = `
			--position-x: calc(50% + ${x}px);
			--position-y: calc(50% + ${y}px);
			--radius: ${neoSize}px;
			--color: ${neoColor};
			--glow: ${neoGlow}px;
		`;

		if (animationProgress < 1) {
			animationId = requestAnimationFrame(animateneo);
		} else {
			// Animation is complete
			cancelAnimationFrame(animationId);
			animationId = null;

			// Reset animation state
			isAnimationPlaying = false;

			// In daily mode, cycle to next NEO after animation completes
			// In live mode, don't automatically cycle - wait for the next real-time event
			// Reset animation progress immediately
			animationProgress = 0;

			// Mark this NEO as already animated to prevent replay
			tracker.markAnimated(neos[activeNeoIndex].id);

			if (mode === 'daily') {
				// In daily mode, add a small pause before cycling to the next NEO
				trackTimeout(() => {
					cycleNeo();
				}, 1000);
			} else {
				// In live mode, check for the next upcoming NEO
				// Always clear the isSwitchingNeo flag when animation completes
				isSwitchingNeo = false;

				// If there's another NEO coming very soon, check immediately
				if (findNextUpcomingNeoSoon(5000)) {
					// Check immediately if another NEO is coming within 5 seconds
					if (mode === 'live') {
						trackTimeout(() => {
							checkLiveUpdate();
						}, 0);
					}
				} else {
					// Normal case, short delay
					trackTimeout(() => {
						// Check for the next upcoming NEO
						if (mode === 'live') {
							checkLiveUpdate();
						}
					}, 100); // Shorter delay for more responsive transitions
				}
			}
		}
	}

	function startAnimation(forceStart = false) {
		// Don't start animation during a mode transition unless forced
		if (isSwitchingNeo && !forceStart) {
			return;
		}

		// Only in live mode: Check if this NEO has already been animated
		// Daily mode should always animate regardless of previous state
		if (mode === 'live' && tracker.hasBeenAnimated(neos[activeNeoIndex].id) && !forceStart) {
			return;
		}

		// Ensure any existing animation is canceled before starting a new one
		if (animationId !== null) {
			cancelAnimationFrame(animationId);
		}

		// Reset animation progress
		animationProgress = 0;

		// Set a flag to prevent interruptions during animation
		isAnimationPlaying = true;

		// Start the animation
		animationId = requestAnimationFrame(animateneo);
	}

	// Function to reset NEO position (used when stopping animations)
	function resetNeoPosition() {
		// Reset NEO to a default position off-screen (not visible)
		neoStyle = `
			--position-x: -9999px;
			--position-y: -9999px;
			--radius: ${neoSize}px;
			--color: ${neoColor};
			--glow: ${neoGlow}px;
		`;
	}

	// Update neo parameters based on NEO properties
	function updateneoPath(neo = activeNeo) {
		const missDistanceKm = parseFloat(neo.close_approach_data[0].miss_distance.kilometers);
		const velocityKmS = parseFloat(
			neo.close_approach_data[0].relative_velocity.kilometers_per_second
		);

		// Earth constants
		const earthDiameterKm = 12742; // Earth's diameter in km
		const earthVisualDiameter = 90; // Earth's visual diameter in pixels
		const earthRadiusVisualized = earthVisualDiameter / 2;

		minVisualDistance = earthRadiusVisualized + 15; // Earth radius + buffer

		// Calculate a visual scaling factor that brings neos closer while preserving relative distances
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
		neoSize = Math.min(earthVisualDiameter * 0.7, scaledSize);

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

			neoColor = `rgba(255, ${greenValue}, ${blueValue}, ${alphaBase})`;
			neoGlow = 18 + velocityNormalized * 15 + diameter * 0.8;

			// Add CSS variable for styling the custom animations
			neoStyle = `
				${neoStyle}
				--neo-core-opacity: 1;
				--neo-inner-glow-opacity: ${0.9 * intenseFactor};
				--neo-outer-glow-opacity: ${0.6 * intenseFactor};
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

			neoColor = `rgba(${redValue}, ${greenValue}, ${blueValue}, ${alphaBase})`;
			neoGlow = 10 + velocityNormalized * 14 + diameter * 0.5;

			// Add CSS variable for styling the custom animations
			neoStyle = `
				${neoStyle}
				--neo-core-opacity: ${0.9 + sizeInfluence * 0.1};
				--neo-inner-glow-opacity: ${0.7 + velocityNormalized * 0.2};
				--neo-outer-glow-opacity: ${0.4 + velocityNormalized * 0.1};
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

	// Helper function to check if there's another NEO approaching soon
	function findNextUpcomingNeoSoon(thresholdMs = 15000): boolean {
		if (!neos || neos.length <= 1) return false;

		const now = new Date();
		let nextNeoCount = 0;

		// Check all NEOs to see if any are approaching soon
		for (let i = 0; i < neos.length; i++) {
			if (i === activeNeoIndex) continue; // Skip current active NEO

			const approachDateStr =
				neos[i].close_approach_data[0]?.close_approach_date_full ||
				neos[i].close_approach_data[0]?.close_approach_date;

			const neoDate = parseDateString(approachDateStr);
			if (!neoDate) continue;

			const timeDiff = neoDate.getTime() - now.getTime();

			// If there's an NEO approaching within the threshold, return true
			if (timeDiff > 0 && timeDiff < thresholdMs) {
				return true;
			}
		}

		return false;
	}

	// Find the next upcoming NEO based on current time
	// Returns an object with the index and time difference in milliseconds
	function findNextUpcomingNeo(): { index: number; timeDiffMs: number } {
		if (!neos || neos.length === 0) return { index: 0, timeDiffMs: Infinity };

		// Get current time in UTC to match NASA's API time format
		const now = new Date();

		// First, find the closest upcoming NEO (positive time diff)
		let upcomingIndex = -1;
		let upcomingTimeDiff = Infinity;

		// Next, also track the most recently passed NEO as fallback
		let recentlyPassedIndex = -1;
		let recentlyPassedTimeDiff = -Infinity;

		// Calculate times for all NEOs
		neos.forEach((neo: NeoWsNearEarthObject, index: number) => {
			const approachDateStr =
				neo.close_approach_data[0]?.close_approach_date_full ||
				neo.close_approach_data[0]?.close_approach_date;

			const neoDate = parseDateString(approachDateStr);
			if (neoDate) {
				// Calculate time difference in milliseconds
				const timeDiff = neoDate.getTime() - now.getTime();

				// Check if this NEO is upcoming
				if (timeDiff > 0 && timeDiff < upcomingTimeDiff) {
					upcomingTimeDiff = timeDiff;
					upcomingIndex = index;
				}

				// Also track recently passed NEOs (within last 2 minutes)
				if (timeDiff <= 0 && timeDiff > -120000 && timeDiff > recentlyPassedTimeDiff) {
					recentlyPassedTimeDiff = timeDiff;
					recentlyPassedIndex = index;
				}
			}
		});

		// If an upcoming NEO exists, use that
		if (upcomingIndex !== -1) {
			return { index: upcomingIndex, timeDiffMs: upcomingTimeDiff };
		}

		// If no upcoming NEO but we have a recently passed one, use that
		if (recentlyPassedIndex !== -1) {
			// Return the recently passed NEO
			return { index: recentlyPassedIndex, timeDiffMs: recentlyPassedTimeDiff };
		}

		// If no upcoming or recently passed NEOs found, return first NEO with indicator
		return { index: 0, timeDiffMs: Infinity };
	}

	// Find the next upcoming NEO after a specific index
	function findNextNeoAfter(currentIndex: number): { index: number; timeDiffMs: number } {
		if (!neos || neos.length === 0) return { index: 0, timeDiffMs: Infinity };

		const now = new Date();

		// Create a sorted array of NEO indices by time difference
		const sortedNeos = neos
			.map((neo: NeoWsNearEarthObject, index: number) => {
				const approachDateStr =
					neo.close_approach_data[0]?.close_approach_date_full ||
					neo.close_approach_data[0]?.close_approach_date;

				const neoDate = parseDateString(approachDateStr);
				if (!neoDate) return { index, timeDiff: Infinity };

				const timeDiff = neoDate.getTime() - now.getTime();
				// Include timestamp for debugging
				return { index, timeDiff, timestamp: neoDate.getTime() };
			})
			// Important: Include all NEOs for sorting, not just future ones
			// We'll filter after sorting to find the closest future NEO
			.sort((a: { index: number; timeDiff: number }, b: { index: number; timeDiff: number }) => {
				// Sort by closest approach time
				return a.timeDiff - b.timeDiff;
			});

		// First try to find the next upcoming NEO that hasn't passed yet
		const nextUpcomingNeo = sortedNeos.find(
			(neo: { index: number; timeDiff: number }) => neo.index !== currentIndex && neo.timeDiff > 0
		);

		if (nextUpcomingNeo) {
			// We found a future NEO that's not the current one
			return { index: nextUpcomingNeo.index, timeDiffMs: nextUpcomingNeo.timeDiff };
		}

		// If no future NEOs found, use the next NEO by approach time (even if it's already passed)
		// This ensures we always move to a different NEO if possible
		const nextNeoByTime = sortedNeos.find(
			(neo: { index: number; timeDiff: number }) => neo.index !== currentIndex
		);

		if (nextNeoByTime) {
			return { index: nextNeoByTime.index, timeDiffMs: nextNeoByTime.timeDiff };
		}

		// If no other NEO found at all, stay with current one but indicate it's not future
		return { index: currentIndex, timeDiffMs: -1 }; // Negative timeDiff indicates it's not a future NEO
	}

	// Get time difference to approach for a specific NEO
	function getTimeDiffToApproach(neo: NeoWsNearEarthObject): number {
		if (!neo) return Infinity;

		const approachDateStr =
			neo.close_approach_data[0]?.close_approach_date_full ||
			neo.close_approach_data[0]?.close_approach_date;

		const neoDate = parseDateString(approachDateStr);
		if (!neoDate) return Infinity;

		// Get current time
		const now = new Date();

		// Calculate time difference in milliseconds
		return neoDate.getTime() - now.getTime();
	}

	// Flag to track if we're currently looking for the next NEO
	let isSwitchingNeo = $state(false);

	// Check if it's time to show the next upcoming NEO in live mode
	function checkLiveUpdate() {
		if (mode === 'live' && !isSwitchingNeo) {
			// Check if there are any upcoming NEOs first
			if (sortedNeoIndices.length === 0) {
				// No need to do anything else - the UI will show "No Upcoming NEOs"
				return;
			}

			// Check if current NEO has already passed
			const currentTimeDiff = getTimeDiffToApproach(neos[activeNeoIndex]);

			// If current NEO has passed and no animation is running or animation is complete,
			// immediately find the next upcoming one
			if (currentTimeDiff < 0 && !isAnimationPlaying) {
				// Set flag to prevent multiple updates
				isSwitchingNeo = true;

				// Find the next NEO that hasn't passed yet
				const { index, timeDiffMs } = findNextNeoAfter(activeNeoIndex);

				// If we found a different NEO to switch to
				if (index !== activeNeoIndex) {
					// Update the active NEO
					activeNeoIndex = index;

					// Prepare the new NEO for visualization
					calculateFlightAngle(neos[activeNeoIndex]);
					updateneoPath(neos[activeNeoIndex]);

					// If the next NEO is approaching very soon, schedule its animation
					if (timeDiffMs >= 0 && timeDiffMs < 10000) {
						trackTimeout(
							() => {
								if (mode === 'live') {
									startAnimation(true); // Force animation start
								}
							},
							Math.max(0, timeDiffMs)
						);
					} else if (timeDiffMs < 0) {
						// The next "best" NEO has also passed, check again soon
						trackTimeout(() => checkLiveUpdate(), 1000);
					}

					// Reset flag after a short delay to ensure rendering is complete
					trackTimeout(() => {
						isSwitchingNeo = false;
					}, 100);
					return;
				}

				// Reset flag if no new NEO was found
				isSwitchingNeo = false;
			}

			// Regular check for the next upcoming NEO
			const { index, timeDiffMs } = findNextUpcomingNeo();

			// Special handling for NEOs that are very close in time to each other
			// If we're still showing the current NEO but another one is passing right now,
			// we might need to skip the current one
			const skipToNext = isAnimationPlaying && findNextUpcomingNeoSoon(0); // 0ms = check if any are passing right now

			// If we need to change to a different NEO or skip to a more urgent one
			if (index !== activeNeoIndex || skipToNext) {
				// If we need to skip the current animation for a more urgent NEO
				if (skipToNext && animationId !== null) {
					cancelAnimationFrame(animationId);
					animationId = null;
					isAnimationPlaying = false;
					animationProgress = 0;

					// Make sure switching flag is cleared
					isSwitchingNeo = false;
				}

				activeNeoIndex = index;
				calculateFlightAngle(neos[activeNeoIndex]);
				updateneoPath(neos[activeNeoIndex]);

				// Check if this NEO has already been animated
				const alreadyAnimated = tracker.hasBeenAnimated(neos[activeNeoIndex].id);

				// Start animation when NEO is passing or about to pass (relaxed timing check)
				// For recently passed NEOs (within 2 minutes), still show them
				const recentlyPassed = timeDiffMs <= 0 && timeDiffMs > -120000;

				// Special handling for test NEO 2 - more generous timing window for recently passed NEOs
				if (recentlyPassed) {
					// For recently passed NEOs, animate if not already animated
					if (!alreadyAnimated) {
						startAnimation(true); // Force start
					} else {
						// Immediately check for next NEO if this one is already animated
						trackTimeout(() => checkLiveUpdate(), 500);
					}
					return;
				} else if (timeDiffMs > 0 && timeDiffMs <= 10000) {
					// Increased window to 10 seconds
					// NEO is about to pass soon, schedule animation precisely
					const animationDelayMs = timeDiffMs;

					trackTimeout(() => {
						if (mode === 'live') {
							// Double-check we're still in live mode
							startAnimation(true); // Force start
						}
					}, animationDelayMs);
					return;
				} else {
					// Stop any running animation if we're not at passing time
					if (animationId !== null) {
						cancelAnimationFrame(animationId);
						animationId = null;
						animationProgress = 0;
					}

					// In live mode, when not animating, hide the NEO
					if (mode === 'live') {
						resetNeoPosition();
					}
				}
			}
			// If we're already on the right NEO, check if we should start animation
			else if (animationId === null && !isAnimationPlaying) {
				// Check if this NEO has already been animated
				const alreadyAnimated = tracker.hasBeenAnimated(neos[activeNeoIndex].id);

				// Handle recently passed NEOs (within 2 minutes)
				const recentlyPassed = timeDiffMs <= 0 && timeDiffMs > -120000;

				if (recentlyPassed && !alreadyAnimated) {
					// Recently passed NEO that hasn't been animated yet
					if (mode === 'live') {
						startAnimation(true); // Force start
						return;
					}
				} else if (timeDiffMs > 0 && timeDiffMs <= 10000) {
					// Increased window to 10 seconds
					// Schedule the animation to start at passing time
					const animationDelayMs = timeDiffMs;

					trackTimeout(() => {
						if (mode === 'live' && animationId === null && !isAnimationPlaying) {
							startAnimation(true); // Force start
						}
					}, animationDelayMs);
					return;
				} else if (timeDiffMs < 0 && !alreadyAnimated) {
					// If this NEO has passed and hasn't been animated, check for next NEO
					trackTimeout(() => checkLiveUpdate(), 100);
				}
			}
		}
	}

	// Get sorted indices of upcoming NEOs in chronological order (present and future)
	let sortedNeoIndices = $derived.by(() => {
		if (!neos || neos.length === 0) return [];

		const now = new Date();

		// Create an array of objects with index and approach time
		const neoTimes: Array<{ index: number; time: number; passTime: number }> = neos.map(
			(neo: NeoWsNearEarthObject, index: number) => {
				const approachDateStr =
					neo.close_approach_data[0]?.close_approach_date_full ||
					neo.close_approach_data[0]?.close_approach_date;

				const neoDate = parseDateString(approachDateStr);
				if (!neoDate) return { index, time: Infinity, passTime: Infinity };

				const timeDiff = neoDate.getTime() - now.getTime();
				return { index, time: timeDiff, passTime: neoDate.getTime() };
			}
		);

		// For sorting and consideration purposes, include NEOs that have passed within the last 2 minutes
		// This ensures we don't miss the second test NEO
		const recentCutoff = -120000; // 2 minutes in milliseconds

		// Calculate a dynamic cutoff for "recent" NEOs - if no upcoming NEOs, consider recent past ones
		const hasUpcoming = neoTimes.some((item) => item.time > 0);
		const timeFilterCutoff = hasUpcoming ? 0 : recentCutoff;

		// First, try to keep only upcoming NEOs. If none available, include recent ones.
		const filteredNeos = neoTimes
			.filter((item: { index: number; time: number }) => item.time > timeFilterCutoff)
			.sort(
				(a: { index: number; time: number }, b: { index: number; time: number }) => a.time - b.time
			);

		// If absolutely no NEOs, try including all NEOs sorted by passing time (not time diff)
		if (filteredNeos.length === 0) {
			return neoTimes.sort((a, b) => a.passTime - b.passTime).map((item) => item.index);
		}

		return filteredNeos.map((item) => item.index);
	});

	// Get current position in the sorted indices for daily mode
	let dailyModePosition = $state(0);

	// Variable to track if there are no upcoming NEOs
	let noUpcomingNeos = $derived(sortedNeoIndices.length === 0);

	// Cycle to the next NEO (used in daily mode)
	function cycleNeo() {
		if (mode === 'daily') {
			if (sortedNeoIndices.length === 0) {
				// If no upcoming NEOs, don't cycle
				return;
			} else {
				// Move to the next NEO in chronological order
				dailyModePosition = (dailyModePosition + 1) % sortedNeoIndices.length;
				activeNeoIndex = sortedNeoIndices[dailyModePosition];
			}

			calculateFlightAngle(neos[activeNeoIndex]);
			updateneoPath(neos[activeNeoIndex]);
			startAnimation(true); // Force start the animation in daily mode
		} else {
			// In live mode, find the next upcoming NEO
			checkLiveUpdate();
		}
	}

	// Parse date from NASA API format (all NASA API dates are in UTC)
	function parseDateString(dateTimeStr: string | undefined): Date | null {
		if (!dateTimeStr) return null;

		try {
			let parsedDate;

			if (dateTimeStr.includes('-')) {
				const parts = dateTimeStr.split(' ');
				if (parts.length === 2) {
					const datePart = parts[0]; // e.g. "2025-Oct-18"
					const timePart = parts[1]; // e.g. "05:42"

					const datePieces = datePart.split('-');
					const year = datePieces[0];
					let month = datePieces[1];
					const day = datePieces[2];

					const monthNames = [
						'Jan',
						'Feb',
						'Mar',
						'Apr',
						'May',
						'Jun',
						'Jul',
						'Aug',
						'Sep',
						'Oct',
						'Nov',
						'Dec'
					];
					const monthIndex = monthNames.findIndex((m) => month.startsWith(m));
					if (monthIndex >= 0) {
						month = String(monthIndex + 1).padStart(2, '0');
					}

					// Create a standard ISO date string with explicit UTC timezone (Z)
					const isoString = `${year}-${month}-${day}T${timePart}:00Z`;
					parsedDate = new Date(isoString);
				} else {
					// Simple date format "YYYY-MM-DD" - assume UTC midnight
					parsedDate = new Date(`${dateTimeStr}T00:00:00Z`);
				}
			} else {
				// Add explicit UTC indicator
				parsedDate = new Date(`${dateTimeStr}Z`);
			}

			if (isNaN(parsedDate.getTime())) {
				console.error('Invalid date parsed from:', dateTimeStr);
				return null;
			}

			return parsedDate;
		} catch (error) {
			console.error('Error parsing date:', error);
			return null;
		}
	}

	// Format approach time (time only)
	function getApproachTime(dateTimeStr: string | undefined) {
		if (!dateTimeStr) return 'Unknown';

		// Parse the date string
		const parsedDate = parseDateString(dateTimeStr);
		if (!parsedDate) return 'Date format error';

		// Get user's timezone
		const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

		// Format the time only
		return parsedDate.toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
			timeZone: userTimeZone
		});
	}

	// Format full date and time
	function getFullDateTime(dateTimeStr: string | undefined) {
		if (!dateTimeStr) return 'Unknown';

		// Parse the date string
		const parsedDate = parseDateString(dateTimeStr);
		if (!parsedDate) return 'Date format error';

		// Get user's timezone
		const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

		// Format the full date and time
		return parsedDate.toLocaleString([], {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			timeZone: userTimeZone
		});
	}

	let currentTime = $state(new Date());

	// Note: The interval is now managed in onMount for proper cleanup

	let clock = $derived.by(() => {
		const now = currentTime;
		return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	});

	// Calculate time remaining until approach for live mode
	let timeUntilApproach = $derived.by(() => {
		if (noUpcomingNeos) return 'No upcoming NEOs';
		if (!activeNeo || mode !== 'live') return null;

		const approachDateStr =
			activeNeo.close_approach_data[0]?.close_approach_date_full ||
			activeNeo.close_approach_data[0]?.close_approach_date;

		const approachDate = parseDateString(approachDateStr);
		if (!approachDate) return 'Unavailable';

		const now = currentTime;
		const diffMs = approachDate.getTime() - now.getTime();

		// Special case for test NEOs that may have passed recently but haven't been animated
		const recentlyPassed = diffMs < 0 && diffMs > -120000; // Within last 2 minutes
		const alreadyAnimated = tracker.hasBeenAnimated(activeNeo.id);

		// Show special messages based on NEO status
		if ((diffMs >= 0 && diffMs < 5000) || (recentlyPassed && isAnimationPlaying)) {
			// About to pass within 5 seconds or recently passed and animating
			return 'PASSING NOW!';
		} else if (diffMs < 0) {
			// If the NEO has passed, check for an update - but don't trigger during transitions
			if (!isSwitchingNeo && !isAnimationPlaying) {
				// Wait a moment before checking for the next NEO (prevents rapid switching)
				if (Math.abs(diffMs) > 2000 && !recentlyPassed) {
					// If it passed more than 2 seconds ago and is not within our "recently passed" window
					trackTimeout(() => checkLiveUpdate(), 100);
				} else if (recentlyPassed && !alreadyAnimated) {
					// Recently passed NEO that hasn't been animated yet
					trackTimeout(() => checkLiveUpdate(), 100);
					return 'PASSING NOW!';
				}
			}

			// Show animation status for NEOs that have passed
			if (isAnimationPlaying) {
				return 'PASSING NOW!';
			} else if (alreadyAnimated || Math.abs(diffMs) > 120000) {
				// If this NEO has been animated already or passed more than 2 minutes ago
				return 'PASSED';
			} else if (recentlyPassed && !alreadyAnimated) {
				// Recently passed but hasn't been animated yet
				return 'PASSING NOW!';
			} else {
				return 'PASSED';
			}
		}

		// Calculate remaining time
		const diffSec = Math.floor(diffMs / 1000);
		const days = Math.floor(diffSec / 86400);
		const hours = Math.floor((diffSec % 86400) / 3600);
		const minutes = Math.floor((diffSec % 3600) / 60);
		const seconds = diffSec % 60;

		// Format the time remaining
		let timeStr = '';
		if (days > 0) timeStr += `${days}d `;
		if (hours > 0 || days > 0) timeStr += `${hours}h `;
		if (minutes > 0 || hours > 0 || days > 0) timeStr += `${minutes}m `;
		timeStr += `${seconds}s`;

		return timeStr;
	});

	// Toggle between daily and live mode
	function toggleMode() {
		// Set the switching flag to prevent animations during mode transition
		isSwitchingNeo = true;

		mode = mode === 'daily' ? 'live' : 'daily';

		// Save mode preference to localStorage
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('neoVisualizerMode', mode);
		}

		// Cancel any running animation
		if (animationId !== null) {
			cancelAnimationFrame(animationId);
			animationId = null;
		}

		// Reset animation state
		animationProgress = 0;
		isAnimationPlaying = false;

		// Reset NEO position to remove it from view during transition
		resetNeoPosition();

		// Also clear any pending timeouts that might trigger new animations
		clearAllTimeouts();

		// Update the active NEO based on the new mode
		if (mode === 'live') {
			// In live mode, show the next upcoming NEO if any exists
			const { index, timeDiffMs } = findNextUpcomingNeo();
			// Only update if we found a valid upcoming NEO
			if (timeDiffMs !== Infinity) {
				activeNeoIndex = index;
			}
		} else {
			// In daily mode, start with the first NEO in chronological order
			if (sortedNeoIndices.length > 0) {
				dailyModePosition = 0;
				activeNeoIndex = sortedNeoIndices[0];
			}
		}

		// Calculate flight angle and update path for visualization
		if (neos && neos.length > 0 && sortedNeoIndices.length > 0) {
			calculateFlightAngle(neos[activeNeoIndex]);
			updateneoPath(neos[activeNeoIndex]);

			// Only start animation immediately in daily mode
			// In live mode, let the timer-based update handle animations
			if (mode === 'daily') {
				// Force animation to start even during transition when switching to daily mode
				startAnimation(true);
			}
		}

		// Reset switching flag after a short delay to complete the transition
		trackTimeout(() => {
			isSwitchingNeo = false;

			// If we switched to daily mode, make sure animation starts
			if (mode === 'daily' && neos && neos.length > 0 && sortedNeoIndices.length > 0) {
				// Double-check that animation isn't already running
				if (animationId === null && !isAnimationPlaying) {
					startAnimation(true);
				}
			}
		}, 1000);
	}

	// Clean up function for timeouts and animation frames
	function cleanUp() {
		if (animationId !== null) {
			cancelAnimationFrame(animationId);
			animationId = null;
		}
		clearAllTimeouts();
		isAnimationPlaying = false;

		// Reset NEO position to remove it from view
		resetNeoPosition();
	}

	onMount(() => {
		// Make sure we're in a browser environment
		if (typeof window === 'undefined') return cleanUp;

		// Reset the tracker when component mounts
		tracker.reset();

		if (neos && neos.length > 0) {
			// Check if there are any upcoming NEOs
			if (sortedNeoIndices.length === 0) {
				// No upcoming NEOs, nothing to do - UI will show "No Upcoming NEOs"
				return cleanUp;
			}

			// Initialize based on mode
			if (mode === 'live') {
				// Find the next upcoming NEO for live mode
				const { index, timeDiffMs } = findNextUpcomingNeo();
				// Only proceed if we found a valid upcoming NEO
				if (timeDiffMs !== Infinity) {
					activeNeoIndex = index;
				}
			} else if (mode === 'daily') {
				// In daily mode, start with the first upcoming NEO in chronological order
				if (sortedNeoIndices.length > 0) {
					dailyModePosition = 0;
					activeNeoIndex = sortedNeoIndices[0];
				}
			}

			calculateFlightAngle(neos[activeNeoIndex]);
			updateneoPath(neos[activeNeoIndex]);

			// Handle initialization based on mode
			if (mode === 'daily') {
				startAnimation(true); // Force start the animation on initial load
			} else if (mode === 'live') {
				// In live mode, check if the NEO is passing right now
				const timeDiffMs = getTimeDiffToApproach(neos[activeNeoIndex]);

				// Only show and animate the NEO if it's passing right now or about to pass soon
				if (timeDiffMs >= 0 && timeDiffMs <= 5000) {
					startAnimation(true);
				} else {
					// Otherwise hide the NEO until it's time to show it
					resetNeoPosition();
				}
			}
		}

		// Setup interval for live updates
		const intervalId = setInterval(() => {
			// Update the current time
			currentTime = new Date();

			// Always update the clock
			// For live updates, check if we need to switch to the next NEO
			// Only check during stable states to prevent interruptions
			if (mode === 'live') {
				// Check if we're in a stable state to update
				const isStableState = !isSwitchingNeo && (!isAnimationPlaying || animationProgress > 0.95);

				// Check for NEO updates in live mode
				if (isStableState) {
					// Check if current NEO has passed without animation
					const timeDiff = getTimeDiffToApproach(neos[activeNeoIndex]);
					const hasBeenAnimated = tracker.hasBeenAnimated(neos[activeNeoIndex].id);
					const recentlyPassed = timeDiff < 0 && timeDiff > -120000; // Within last 2 minutes

					// If NEO has passed recently and hasn't been animated yet, check for animation
					if (recentlyPassed && !hasBeenAnimated && !isAnimationPlaying) {
						checkLiveUpdate();
					}
					// If NEO passed long ago and hasn't been animated, we probably need to move on
					else if (timeDiff < -120000 && !hasBeenAnimated && !isAnimationPlaying) {
						checkLiveUpdate();
					}
					// Regular periodic check with higher frequency to ensure we don't miss the second test NEO
					else if (Math.random() < 0.5) {
						// Increased from 0.3 to 0.5 for more frequent checks
						// Check half the time
						checkLiveUpdate();
					}
				}
			}
		}, 150); // Check more frequently for better responsiveness (was 200ms)

		// Return cleanup function to handle component unmount
		return () => {
			clearInterval(intervalId);
			cleanUp();
		};
	});
</script>

<div class="space {$isFullScreen ? 'fullscreen' : ''}">
	<button class="fullscreen-toggle" onclick={() => ($isFullScreen = !$isFullScreen)}>
		{#if $isFullScreen}
			<img src={exitFullscreen} alt="Exit Fullscreen" title="Exit Fullscreen" />
		{:else}
			<img src={enterFullscreen} alt="Enter Fullscreen" title="Enter Fullscreen" />
		{/if}
	</button>
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
		<div class="mode-toggle-container">
			<button
				class="mode-toggle-button {mode === 'daily' ? 'active' : ''}"
				onclick={() => mode === 'live' && toggleMode()}
			>
				Daily
			</button>
			<button
				class="mode-toggle-button {mode === 'live' ? 'active' : ''}"
				onclick={() => mode === 'daily' && toggleMode()}
			>
				Live
			</button>
		</div>
	</div>
	<img src={earth} alt="" class="earth" />
	{#if noUpcomingNeos}
		<div class="neo-info no-upcoming">
			<div class="neo-info-header">
				<h3>No Upcoming NEOs</h3>
			</div>
			<p>There are no near-Earth objects approaching within the next 24 hours.</p>
		</div>
	{:else if activeNeo}
		<div class="neo-info">
			<div class="neo-info-header">
				<h3>{activeNeo?.name}</h3>
			</div>
			<p>
				Diameter: ~{activeNeo?.estimated_diameter?.kilometers.estimated_diameter_max.toFixed(2)}km /
				~{activeNeo?.estimated_diameter.meters?.estimated_diameter_max.toFixed(0)}m
			</p>
			<p>
				Miss distance: {parseFloat(
					activeNeo?.close_approach_data[0]?.miss_distance.lunar || '0'
				).toFixed(2)} lunar distances
			</p>
			<p>
				Speed: {parseFloat(
					activeNeo?.close_approach_data[0]?.relative_velocity?.kilometers_per_second || '0'
				).toFixed(2)} km/s
			</p>
			<p>
				Approach time: {getApproachTime(
					activeNeo?.close_approach_data[0]?.close_approach_date_full ||
						activeNeo?.close_approach_data[0]?.close_approach_date
				)}
			</p>

			{#if mode === 'live'}
				{#if timeUntilApproach}
					<p class="countdown {timeUntilApproach.includes('PASSING NOW') ? 'passing-now' : ''}">
						{timeUntilApproach.includes('PASSING NOW') ? '' : 'Time until approach: '}
						<span class="countdown-time">{timeUntilApproach}</span>
					</p>
				{/if}
			{/if}

			<p class={activeNeo?.is_potentially_hazardous_asteroid ? 'hazard' : 'no-hazard'}>
				{activeNeo?.is_potentially_hazardous_asteroid ? 'Potentially Hazardous' : 'Not Hazardous'}
			</p>
		</div>
		<div class="neo-container" style={neoStyle}>
			<span class="neo"></span>
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

		&.fullscreen {
			height: 100vh;
		}
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
	.neo-container {
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

	.neo {
		--neo-core-opacity: 1;
		--neo-inner-glow-opacity: 0.8;
		--neo-outer-glow-opacity: 0.5;
		position: absolute;
		width: var(--radius);
		height: var(--radius);
		background: radial-gradient(circle, var(--color), transparent 80%);
		border-radius: 50%;
		z-index: 4;
		transform: translate(-50%, -50%);
		animation: neo-pulse 3s infinite alternate ease-in-out;
		box-shadow: 0 0 calc(var(--glow) / 2) var(--color);
	}

	/* Inner glow */
	.neo::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		width: calc(var(--radius) * 1.8);
		height: calc(var(--radius) * 1.8);
		background: radial-gradient(circle, var(--color), transparent 70%);
		border-radius: 50%;
		transform: translate(-50%, -50%);
		opacity: var(--neo-inner-glow-opacity);
		z-index: 3;
		animation: neo-glow 2s infinite alternate ease-in-out;
	}

	/* Outer glow */
	.neo::after {
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
		opacity: var(--neo-outer-glow-opacity);
		z-index: 2;
		animation: neo-outer-glow 4s infinite alternate ease-in-out;
		filter: blur(2px);
	}

	@keyframes neo-glow {
		0% {
			opacity: var(--neo-inner-glow-opacity);
			transform: translate(-50%, -50%) scale(0.9);
		}
		100% {
			opacity: calc(var(--neo-inner-glow-opacity) * 0.8);
			transform: translate(-50%, -50%) scale(1.1);
		}
	}

	@keyframes neo-outer-glow {
		0% {
			opacity: var(--neo-outer-glow-opacity);
			transform: translate(-50%, -50%) scale(0.95);
		}
		100% {
			opacity: calc(var(--neo-outer-glow-opacity) * 0.7);
			transform: translate(-50%, -50%) scale(1.05);
		}
	}

	@keyframes neo-pulse {
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
		background: rgba(0, 30, 60, 0.4);
		color: white;
		padding: 18px;
		border-radius: 12px;
		max-width: 320px;
		z-index: 3;
		border: 1px solid rgba(100, 200, 255, 0.2);
		box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
	}

	.neo-info.no-upcoming {
		border: 1px solid rgba(255, 150, 100, 0.3);
		background: rgba(40, 20, 10, 0.4);
	}
	.neo-info h3 {
		margin: 0 0 10px 0;
		color: #5df3ff;
		font-size: 1.2rem;
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

	.mode-toggle-container {
		display: flex;
		margin-top: 20px;
		background: rgba(0, 30, 60, 0.4);
		padding: 5px;
		border-radius: 30px;
		border: 1px solid rgba(100, 200, 255, 0.2);
		display: flex;
		align-items: center;
		justify-content: center;
		width: fit-content;
		margin: 0 auto 1rem auto;
	}

	.mode-toggle-button {
		background: none;
		border: none;
		color: #ccc;
		padding: 8px 20px;
		border-radius: 25px;
		cursor: pointer;
		font-size: 14px;
		font-weight: bold;
		transition: all 0.3s ease;
	}

	.mode-toggle-button.active {
		background: rgba(93, 243, 255, 0.2);
		color: #5df3ff;
		box-shadow: 0 0 10px rgba(93, 243, 255, 0.3);
	}

	.mode-toggle-button:hover:not(.active) {
		color: #fff;
	}

	.neo-info-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 15px;
		padding-bottom: 12px;
		border-bottom: 1px solid rgba(100, 200, 255, 0.2);

		h3 {
			margin: 0;
		}
	}

	.countdown {
		margin-top: 10px;
	}

	.countdown-time {
		font-weight: 600;
		color: #5df3ff;
		font-family: monospace;
		letter-spacing: 0.5px;
		text-shadow: 0 0 8px rgba(93, 243, 255, 0.3);
	}

	.countdown.passing-now {
		background: rgba(255, 50, 50, 0.25);
		border-radius: 8px;
		border: 1px solid rgba(255, 50, 50, 0.35);
		box-shadow: 0 0 15px rgba(255, 50, 50, 0.2);
		animation: pulse-background 2s infinite alternate ease-in-out;
		text-align: center;
		padding: 4px 8px;
		margin-block: 0.5rem;
	}

	.countdown.passing-now .countdown-time {
		color: #ffcc00;
		font-size: 1.1rem;
		font-weight: 700;
		text-shadow: 0 0 10px rgba(255, 204, 0, 0.7);
		letter-spacing: 0.7px;
	}

	@keyframes pulse-text {
		0% {
			opacity: 0.7;
		}
		100% {
			opacity: 1;
		}
	}

	.fullscreen-toggle {
		position: absolute;
		top: 10px;
		right: 10px;
		cursor: pointer;
		z-index: 10;
		background: transparent;
		border: none;
		filter: invert(1);
		padding: 0;
		margin: 0;

		img {
			width: 24px;
			height: 24px;
		}
	}

	@keyframes pulse-background {
		0% {
			background: rgba(255, 50, 50, 0.15);
		}
		100% {
			background: rgba(255, 50, 50, 0.35);
		}
	}
</style>
