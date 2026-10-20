import { DEFAULT_RATIO, TIERS_DESC, TROOP_TYPES } from "./types.js";
function emptyStats() {
    return { attack: 0, defense: 0, health: 0, lethality: 0 };
}
export class TroopComposition {
    constructor() {
        this.infantry = {};
        this.cavalry = {};
        this.archer = {};
        this.averageTroopBaseStats = {
            type: {
                infantry: emptyStats(),
                cavalry: emptyStats(),
                archer: emptyStats()
            }
        };
    }
    setTroops(type, tg, tier, amount) {
        const safeAmount = Math.max(0, Math.floor(amount));
        if (!this[type][tg]) {
            this[type][tg] = {};
        }
        this[type][tg][tier] = safeAmount;
    }
    addTroops(type, tg, tier, amount) {
        if (amount <= 0)
            return;
        if (!this[type][tg]) {
            this[type][tg] = {};
        }
        this[type][tg][tier] = (this[type][tg][tier] ?? 0) + Math.floor(amount);
    }
    getTroops(type, tg, tier) {
        return this[type][tg]?.[tier] ?? 0;
    }
    getClassTotal(type) {
        let total = 0;
        for (const tiers of Object.values(this[type])) {
            if (!tiers)
                continue;
            for (const amount of Object.values(tiers)) {
                total += amount ?? 0;
            }
        }
        return total;
    }
    getTierTroops(type, tier) {
        let total = 0;
        for (const tiers of Object.values(this[type])) {
            total += tiers?.[tier] ?? 0;
        }
        return total;
    }
    getTotal() {
        return TROOP_TYPES.reduce((sum, type) => sum + this.getClassTotal(type), 0);
    }
    /**
     * Estimates the base stats of the troops likely to be used by taking the
     * strongest troops required for the default 1:20:79 composition.
     */
    calculateAverageTroopBaseStats(totalDeployableTroops, armyStats) {
        for (const type of TROOP_TYPES) {
            const wanted = totalDeployableTroops * DEFAULT_RATIO[type];
            this.averageTroopBaseStats.type[type] = this.calculateAverageForClass(type, this[type], wanted, armyStats);
        }
    }
    calculateAverageForClass(type, composition, wantedTroops, armyStats) {
        const groups = [];
        for (const [tgKey, tiers] of Object.entries(composition)) {
            if (!tiers)
                continue;
            const tg = tgKey;
            for (const tier of TIERS_DESC) {
                const amount = tiers[tier] ?? 0;
                if (amount <= 0)
                    continue;
                const stats = armyStats.type[type].tg[tg]?.[tier];
                if (!stats)
                    continue;
                groups.push({
                    type,
                    tg,
                    tier,
                    amount,
                    stats,
                    damage: stats.attack * stats.lethality
                });
            }
        }
        groups.sort((a, b) => b.damage - a.damage);
        return this.calculateWeightedAverage(groups, wantedTroops);
    }
    calculateWeightedAverage(groups, wantedTroops) {
        let remaining = Math.max(0, Math.floor(wantedTroops));
        let usedTroops = 0;
        let attackSum = 0;
        let defenseSum = 0;
        let healthSum = 0;
        let lethalitySum = 0;
        for (const group of groups) {
            if (remaining <= 0)
                break;
            const used = Math.min(group.amount, remaining);
            attackSum += group.stats.attack * used;
            defenseSum += group.stats.defense * used;
            healthSum += group.stats.health * used;
            lethalitySum += group.stats.lethality * used;
            usedTroops += used;
            remaining -= used;
        }
        if (usedTroops === 0) {
            return emptyStats();
        }
        return {
            attack: attackSum / usedTroops,
            defense: defenseSum / usedTroops,
            health: healthSum / usedTroops,
            lethality: lethalitySum / usedTroops
        };
    }
}
