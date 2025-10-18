import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Create a browser-safe store to prevent SSR issues
export const isFullScreen = writable(false);
