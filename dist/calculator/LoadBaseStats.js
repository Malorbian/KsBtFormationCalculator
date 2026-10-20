export class BaseStatLoader {
    constructor(data) {
        this.data = data;
    }
    static async load(path = "./res/troop-stats-tg-first.json") {
        try {
            const response = await fetch(path, { cache: "no-cache" });
            if (!response.ok) {
                console.error(`Failed to load troop stats: HTTP ${response.status}`);
                return null;
            }
            const rawData = await response.json();
            return new BaseStatLoader(rawData);
        }
        catch (error) {
            console.error("Failed to load troop stats:", error);
            return null;
        }
    }
    getTroopBaseStats() {
        return this.data;
    }
}
