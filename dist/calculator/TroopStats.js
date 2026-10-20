export class TroopStats {
    constructor(data) {
        this.data = data;
    }
    static async load(path = "res/troop-stats.json") {
        try {
            const response = await fetch(path, { cache: "no-cache" });
            if (!response.ok) {
                return null;
            }
            const rawData = await response.json();
            return new TroopStats(rawData);
        }
        catch {
            return null;
        }
    }
    calculateDamage(attackFactor, lethalityFactor, troopType, tierName, tgLevel) {
        const baseStats = this.data.tiers[tierName]?.[troopType];
        if (!baseStats) {
            return 0;
        }
        const bonusStats = this.data.tgBonuses[troopType]?.[tgLevel] ?? { attack: 0, lethality: 0 };
        const attack = baseStats.attack + bonusStats.attack;
        const lethality = baseStats.lethality + bonusStats.lethality;
        return (attack * attackFactor) * (lethality * lethalityFactor);
    }
}
