let cachedStats = null;
export async function initializeOffensiveStats() {
    try {
        const response = await fetch("res/offensive-stats.json", { cache: "no-cache" });
        if (!response.ok) {
            cachedStats = null;
            return;
        }
        const rawData = await response.json();
        cachedStats = rawData;
    }
    catch {
        cachedStats = null;
    }
}
export function getOffensiveStats() {
    return cachedStats;
}
