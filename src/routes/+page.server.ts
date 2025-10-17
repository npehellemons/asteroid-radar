import { PRIVATE_NASA_API_KEY } from "$env/static/private";
import type { NeoWsCache, NeoWsResponse } from "$lib";
import type { PageServerLoad } from "./$types";

let cache: NeoWsCache | null = null;

export const load: PageServerLoad = async () => {
    try {
        const today = new Date().toISOString().split("T")[0];

        if (cache && cache.date === today) {
            return { data: cache.data };
        }
        const response = await fetch(`https://api.nasa.gov/neo/rest/v1/feed?start_date=${today}&end_date=${today}&api_key=${PRIVATE_NASA_API_KEY}`);
        const rateLimit = response.headers.get('X-RateLimit-Limit');
        const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
        console.log(`NASA API Rate Limit - Total: ${rateLimit}, Remaining: ${rateLimitRemaining}`);

        if (response.ok) {
            const data = await response.json() as NeoWsResponse;
            cache = {
                data,
                date: today
            };

            try {
                const neos = data?.near_earth_objects[Object.keys(data?.near_earth_objects || {})[0]] || [];
                for (const neo of neos) {
                    const neoResponse = await fetch(`https://api.nasa.gov/neo/rest/v1/neo/${neo.id}?api_key=${PRIVATE_NASA_API_KEY}`);
                    const detailRateLimit = neoResponse.headers.get('X-RateLimit-Limit');
                    const detailRateLimitRemaining = neoResponse.headers.get('X-RateLimit-Remaining');
                    console.log(`NASA API Rate Limit (NEO detail ${neo.id}) - Total: ${detailRateLimit}, Remaining: ${detailRateLimitRemaining}`);

                    if (neoResponse.ok) {
                        const neoDetails = await neoResponse.json();
                        Object.assign(neo, {
                            orbital_data: neoDetails.orbital_data
                        });
                    }
                }
            } catch (error) {
                return { data };
            }
            return { data };
        }
        return {};
    } catch (error) {
        return {};
    }
};