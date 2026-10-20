import type {
    ArmyStats,
    AverageTroopStats,
    TierName,
    TgLevel,
    TroopGroup,
    TroopStats,
    TroopType
} from "./types.js";
import { DEFAULT_RATIO, TIERS_DESC, TROOP_TYPES } from "./types.js";

export type TroopAmounts = Partial<Record<TgLevel, Partial<Record<TierName, number>>>>;

function emptyStats(): TroopStats {
    return { attack: 0, defense: 0, health: 0, lethality: 0 };
}

export class TroopComposition {
    public infantry: TroopAmounts = {};
    public cavalry: TroopAmounts = {};
    public archer: TroopAmounts = {};

    public averageTroopBaseStats: AverageTroopStats = {
        type: {
            infantry: emptyStats(),
            cavalry: emptyStats(),
            archer: emptyStats()
        }
    };

    public setTroops(
        type: TroopType,
        tg: TgLevel,
        tier: TierName,
        amount: number
    ): void {
        const safeAmount = Math.max(0, Math.floor(amount));
        if (!this[type][tg]) {
            this[type][tg] = {};
        }
        this[type][tg]![tier] = safeAmount;
    }

    public addTroops(
        type: TroopType,
        tg: TgLevel,
        tier: TierName,
        amount: number
    ): void {
        if (amount <= 0) return;
        if (!this[type][tg]) {
            this[type][tg] = {};
        }
        this[type][tg]![tier] = (this[type][tg]![tier] ?? 0) + Math.floor(amount);
    }

    public getTroops(type: TroopType, tg: TgLevel, tier: TierName): number {
        return this[type][tg]?.[tier] ?? 0;
    }

    public getClassTotal(type: TroopType): number {
        let total = 0;
        for (const tiers of Object.values(this[type])) {
            if (!tiers) continue;
            for (const amount of Object.values(tiers)) {
                total += amount ?? 0;
            }
        }
        return total;
    }

    public getTierTroops(type: TroopType, tier: TierName): number {
        let total = 0;
        for (const tiers of Object.values(this[type])) {
            total += tiers?.[tier] ?? 0;
        }
        return total;
    }

    public getTotal(): number {
        return TROOP_TYPES.reduce((sum, type) => sum + this.getClassTotal(type), 0);
    }

    /**
     * Estimates the base stats of the troops likely to be used by taking the
     * strongest troops required for the default 1:20:79 composition.
     */
    public calculateAverageTroopBaseStats(
        totalDeployableTroops: number,
        armyStats: ArmyStats
    ): void {
        for (const type of TROOP_TYPES) {
            const wanted = totalDeployableTroops * DEFAULT_RATIO[type];
            this.averageTroopBaseStats.type[type] = this.calculateAverageForClass(
                type,
                this[type],
                wanted,
                armyStats
            );
        }
    }

    private calculateAverageForClass(
        type: TroopType,
        composition: TroopAmounts,
        wantedTroops: number,
        armyStats: ArmyStats
    ): TroopStats {
        const groups: TroopGroup[] = [];

        for (const [tgKey, tiers] of Object.entries(composition)) {
            if (!tiers) continue;
            const tg = tgKey as TgLevel;

            for (const tier of TIERS_DESC) {
                const amount = tiers[tier] ?? 0;
                if (amount <= 0) continue;

                const stats = armyStats.type[type].tg[tg]?.[tier];
                if (!stats) continue;

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

    private calculateWeightedAverage(
        groups: TroopGroup[],
        wantedTroops: number
    ): TroopStats {
        let remaining = Math.max(0, Math.floor(wantedTroops));
        let usedTroops = 0;
        let attackSum = 0;
        let defenseSum = 0;
        let healthSum = 0;
        let lethalitySum = 0;

        for (const group of groups) {
            if (remaining <= 0) break;

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
