import { TroopStats } from "./TroopStats.js";
let cachedTroopStats = null;
export async function initializeTroopStats() {
    cachedTroopStats = await TroopStats.load();
}
export function getTroopStats() {
    return cachedTroopStats;
}
