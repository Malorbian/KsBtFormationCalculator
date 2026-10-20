import type { ArmyStats } from "./types.js";

export class BaseStatLoader {
    public constructor(private readonly data: ArmyStats) { }

    public static async load(
        path = "./res/troop-stats-tg-first.json"
    ): Promise<BaseStatLoader | null> {
        try {
            const response = await fetch(path, { cache: "no-cache" });
            if (!response.ok) {
                console.error(`Failed to load troop stats: HTTP ${response.status}`);
                return null;
            }

            const rawData = await response.json() as ArmyStats;
            return new BaseStatLoader(rawData);
        } catch (error) {
            console.error("Failed to load troop stats:", error);
            return null;
        }
    }

    public getTroopBaseStats(): ArmyStats {
        return this.data;
    }
}
