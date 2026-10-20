import type { AverageTroopStats, BonusStats, ClassTgLevels, TargetRatio, TroopType } from "./types.js";
import { DEFAULT_RATIO } from "./types.js";

/**
 * Calculates the optimal Bear ratio from the rally leader stats.
 *

 */
export class RatioCalculation {

    public static calculateFromStats(
        bonusStats: BonusStats,
        averageTroopStats: AverageTroopStats,
        tgLevels: ClassTgLevels,
    ): TargetRatio {
        const attackFactors: Record<TroopType, number> = {
            infantry: this.calculateAttackFactor(averageTroopStats, bonusStats, "infantry"),
            cavalry: this.calculateAttackFactor(averageTroopStats, bonusStats, "cavalry"),
            archer: this.calculateAttackFactor(averageTroopStats, bonusStats, "archer")
        };

        const alpha = attackFactors.infantry;

        let beta = attackFactors.cavalry;
        if (tgLevels.cavalry == "TG5") {
            beta *= 1.15;
        } else if (tgLevels.cavalry == "TG4" || tgLevels.cavalry == "TG3") {
            beta *= 1.1;
        }

        let gamma = attackFactors.archer;
        gamma *= 1.1;  // Factor because bear troops are only infantry
        gamma *= 1.1;  // Factor for T7+ archer troops. TODO: Adjust in future if lower tier should be considered
        if (tgLevels.archer == "TG5") {
            gamma *= 1.15;
        } else if (tgLevels.archer == "TG4" || tgLevels.archer == "TG3") {
            gamma *= 1.1;
        }

        const infantryWeight = alpha ** 2;
        const cavalryWeight = beta ** 2;
        const archerWeight = gamma ** 2;

        const denominator = infantryWeight + cavalryWeight + archerWeight;

        if (!Number.isFinite(denominator) || denominator <= 0) {
            return { ...DEFAULT_RATIO };
        }

        return {
            infantry: infantryWeight / denominator,
            cavalry: cavalryWeight / denominator,
            archer: archerWeight / denominator
        };
    }

    /**
     * A in the Bear formula. The calculator currently derives it from the
     * average base Attack/Lethality of the troops that are likely to be used
     * and the rally leader's entered Attack/Lethality bonuses.
     *
     * Keeping this separate makes it easy to replace only the exact A formula
     * later if the underlying theory-crafting formula changes.
     */
    private static calculateAttackFactor(
        stats: AverageTroopStats,
        bonusStats: BonusStats,
        type: TroopType
    ): number {
        const base = stats.type[type];
        const bonus = bonusStats.type[type];

        const attackFactor =
            base.attack * (1 + bonus.attack / 100)
            * base.lethality * (1 + bonus.lethality / 100);

        return Math.max(0, attackFactor);
    }
}
