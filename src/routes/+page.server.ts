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

            // Setup test NEO timing
            const now = new Date();
            // First test NEO will pass in 60 seconds
            const testPassingTime = new Date(now.getTime() + 60000);
            // Second test NEO will pass in 120 seconds
            const testPassingTime2 = new Date(now.getTime() + 120000);
            // Third test NEO will pass in 250 seconds
            const testPassingTime3 = new Date(now.getTime() + 250000);

            // Month names array for date formatting (NASA API format)
            const testMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

            // Format the date in UTC (NASA API uses UTC format)
            const testMonth = testMonthNames[testPassingTime.getUTCMonth()];
            const testDay = testPassingTime.getUTCDate().toString().padStart(2, '0');
            const testYear = testPassingTime.getUTCFullYear();
            const testHour = testPassingTime.getUTCHours().toString().padStart(2, '0');
            const testMinute = testPassingTime.getUTCMinutes().toString().padStart(2, '0');
            const testDateStr = `${testYear}-${testMonth}-${testDay} ${testHour}:${testMinute}`;

            // Create test NEO object
            const testNeo = {
                links: {
                    self: "https://api.nasa.gov/neo/rest/v1/neo/test-neo-1"
                },
                id: "test-neo-1",
                neo_reference_id: "test-neo-1",
                name: "Test NEO",
                nasa_jpl_url: "https://example.com/test",
                absolute_magnitude_h: 20.5,
                estimated_diameter: {
                    kilometers: {
                        estimated_diameter_min: 0.2,
                        estimated_diameter_max: 0.45
                    },
                    meters: {
                        estimated_diameter_min: 200,
                        estimated_diameter_max: 450
                    },
                    miles: {
                        estimated_diameter_min: 0.1242,
                        estimated_diameter_max: 0.2795
                    },
                    feet: {
                        estimated_diameter_min: 656.1,
                        estimated_diameter_max: 1476.4
                    }
                },
                is_potentially_hazardous_asteroid: true,
                close_approach_data: [
                    {
                        close_approach_date: testDateStr.split(" ")[0],
                        close_approach_date_full: testDateStr,
                        epoch_date_close_approach: testPassingTime.getTime(),
                        relative_velocity: {
                            kilometers_per_second: "25.3",
                            kilometers_per_hour: "91080",
                            miles_per_hour: "56593.4"
                        },
                        miss_distance: {
                            astronomical: "0.0485",
                            lunar: "18.8",
                            kilometers: "7254000",
                            miles: "4507000"
                        },
                        orbiting_body: "Earth"
                    }
                ],
                is_sentry_object: false,
                // Add optional orbital data
                orbital_data: {
                    orbit_id: "test-orbit",
                    orbit_determination_date: testDateStr,
                    first_observation_date: "2023-01-01",
                    last_observation_date: "2025-10-17",
                    data_arc_in_days: 365,
                    observations_used: 50,
                    orbit_uncertainty: "0",
                    minimum_orbit_intersection: "0.05",
                    jupiter_tisserand_invariant: "4.5",
                    epoch_osculation: "2025-10-18",
                    eccentricity: "0.35",
                    semi_major_axis: "1.5",
                    inclination: "12.5",
                    ascending_node_longitude: "180",
                    orbital_period: "550",
                    perihelion_distance: "0.9",
                    perihelion_argument: "90",
                    aphelion_distance: "2.1",
                    perihelion_time: "2025-10-18",
                    mean_anomaly: "45",
                    mean_motion: "0.65",
                    equinox: "J2000",
                    orbit_class: {
                        orbit_class_type: "AMO",
                        orbit_class_description: "Test orbit class",
                        orbit_class_range: "Test range"
                    }
                }
            };

            // Format the date for the second NEO in UTC
            const testMonth2 = testMonthNames[testPassingTime2.getUTCMonth()];
            const testDay2 = testPassingTime2.getUTCDate().toString().padStart(2, '0');
            const testYear2 = testPassingTime2.getUTCFullYear();
            const testHour2 = testPassingTime2.getUTCHours().toString().padStart(2, '0');
            const testMinute2 = testPassingTime2.getUTCMinutes().toString().padStart(2, '0');
            const testDateStr2 = `${testYear2}-${testMonth2}-${testDay2} ${testHour2}:${testMinute2}`;

            const testNeo2 = {
                links: {
                    self: "https://api.nasa.gov/neo/rest/v1/neo/test-neo-2"
                },
                id: "test-neo-2",
                neo_reference_id: "test-neo-2",
                name: "Test NEO 2",
                nasa_jpl_url: "https://example.com/test2",
                absolute_magnitude_h: 18.2,
                estimated_diameter: {
                    kilometers: {
                        estimated_diameter_min: 0.5,
                        estimated_diameter_max: 1.1
                    },
                    meters: {
                        estimated_diameter_min: 500,
                        estimated_diameter_max: 1100
                    },
                    miles: {
                        estimated_diameter_min: 0.31,
                        estimated_diameter_max: 0.68
                    },
                    feet: {
                        estimated_diameter_min: 1640,
                        estimated_diameter_max: 3608
                    }
                },
                is_potentially_hazardous_asteroid: false,
                close_approach_data: [
                    {
                        close_approach_date: testDateStr2.split(" ")[0],
                        close_approach_date_full: testDateStr2,
                        epoch_date_close_approach: testPassingTime2.getTime(),
                        relative_velocity: {
                            kilometers_per_second: "15.7",
                            kilometers_per_hour: "56520",
                            miles_per_hour: "35120"
                        },
                        miss_distance: {
                            astronomical: "0.0927",
                            lunar: "36.0",
                            kilometers: "13867620",
                            miles: "8616246"
                        },
                        orbiting_body: "Earth"
                    }
                ],
                is_sentry_object: false,
                orbital_data: {
                    orbit_id: "test-orbit-2",
                    orbit_determination_date: testDateStr2,
                    first_observation_date: "2023-02-15",
                    last_observation_date: "2025-10-17",
                    data_arc_in_days: 320,
                    observations_used: 42,
                    orbit_uncertainty: "0",
                    minimum_orbit_intersection: "0.08",
                    jupiter_tisserand_invariant: "5.2",
                    epoch_osculation: "2025-10-18",
                    eccentricity: "0.28",
                    semi_major_axis: "1.8",
                    inclination: "9.3",
                    ascending_node_longitude: "210",
                    orbital_period: "720",
                    perihelion_distance: "1.2",
                    perihelion_argument: "120",
                    aphelion_distance: "2.4",
                    perihelion_time: "2025-10-18",
                    mean_anomaly: "50",
                    mean_motion: "0.5",
                    equinox: "J2000",
                    orbit_class: {
                        orbit_class_type: "ATE",
                        orbit_class_description: "Test orbit class 2",
                        orbit_class_range: "Test range 2"
                    }
                }
            };

            // Format the date for the third NEO in UTC
            const testMonth3 = testMonthNames[testPassingTime3.getUTCMonth()];
            const testDay3 = testPassingTime3.getUTCDate().toString().padStart(2, '0');
            const testYear3 = testPassingTime3.getUTCFullYear();
            const testHour3 = testPassingTime3.getUTCHours().toString().padStart(2, '0');
            const testMinute3 = testPassingTime3.getUTCMinutes().toString().padStart(2, '0');
            const testDateStr3 = `${testYear3}-${testMonth3}-${testDay3} ${testHour3}:${testMinute3}`;

            const testNeo3 = {
                links: {
                    self: "https://api.nasa.gov/neo/rest/v1/neo/test-neo-3"
                },
                id: "test-neo-3",
                neo_reference_id: "test-neo-3",
                name: "Test NEO 3",
                nasa_jpl_url: "https://example.com/test3",
                absolute_magnitude_h: 18.2,
                estimated_diameter: {
                    kilometers: {
                        estimated_diameter_min: 0.5,
                        estimated_diameter_max: 1.1
                    },
                    meters: {
                        estimated_diameter_min: 500,
                        estimated_diameter_max: 1100
                    },
                    miles: {
                        estimated_diameter_min: 0.31,
                        estimated_diameter_max: 0.68
                    },
                    feet: {
                        estimated_diameter_min: 1640,
                        estimated_diameter_max: 3608
                    }
                },
                is_potentially_hazardous_asteroid: false,
                close_approach_data: [
                    {
                        close_approach_date: testDateStr3.split(" ")[0],
                        close_approach_date_full: testDateStr3,
                        epoch_date_close_approach: testPassingTime3.getTime(),
                        relative_velocity: {
                            kilometers_per_second: "15.7",
                            kilometers_per_hour: "56520",
                            miles_per_hour: "35120"
                        },
                        miss_distance: {
                            astronomical: "0.0927",
                            lunar: "36.0",
                            kilometers: "13867620",
                            miles: "8616246"
                        },
                        orbiting_body: "Earth"
                    }
                ],
                is_sentry_object: false,
                orbital_data: {
                    orbit_id: "test-orbit-3",
                    orbit_determination_date: testDateStr3,
                    first_observation_date: "2023-02-15",
                    last_observation_date: "2025-10-17",
                    data_arc_in_days: 320,
                    observations_used: 42,
                    orbit_uncertainty: "0",
                    minimum_orbit_intersection: "0.08",
                    jupiter_tisserand_invariant: "5.2",
                    epoch_osculation: "2025-10-18",
                    eccentricity: "0.28",
                    semi_major_axis: "1.8",
                    inclination: "9.3",
                    ascending_node_longitude: "210",
                    orbital_period: "720",
                    perihelion_distance: "1.2",
                    perihelion_argument: "120",
                    aphelion_distance: "2.4",
                    perihelion_time: "2025-10-18",
                    mean_anomaly: "50",
                    mean_motion: "0.5",
                    equinox: "J2000",
                    orbit_class: {
                        orbit_class_type: "ATE",
                        orbit_class_description: "Test orbit class 3",
                        orbit_class_range: "Test range 3"
                    }
                }
            };

            // Add the test NEOs to today's data
            const todayKey = Object.keys(data.near_earth_objects)[0];
            data.near_earth_objects[todayKey] = [testNeo, testNeo2, testNeo3, ...data.near_earth_objects[todayKey]];

            // Update element_count
            data.element_count += 2;

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