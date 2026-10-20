import type { TroopComposition } from "./TroopComposition.js";
import { TroopComposition as Composition } from "./TroopComposition.js";
import type {
    ArmyStats,
    ClassTgLevels,
    FillMode,
    FormationResult,
    TargetRatio,
    TierName,
    TroopClassAmounts,
    TroopGroup,
    TroopType
} from "./types.js";
import { TIERS_DESC, TROOP_TYPES } from "./types.js";

interface MarchPlan {
    kind: "host" | "join";
    capacity: number;
}

const MIN_CLASS_SHARE_DAMAGE_MODE = 0.10;

function emptyAmounts(): TroopClassAmounts {
    return { infantry: 0, cavalry: 0, archer: 0 };
}

export class MarchFiller {

    public static fill(
        availableTroops: TroopComposition,
        targetRatio: TargetRatio,
        hostCapacity: number,
        joinerCapacity: number,
        joinerCount: number,
        hostOwn: boolean,
        tgLevels: ClassTgLevels,
        armyStats: ArmyStats
    ): FormationResult {
        const marchPlans = this.createMarchPlans(
            hostCapacity,
            joinerCapacity,
            joinerCount,
            hostOwn
        );

        const totalCapacity = marchPlans.reduce((sum, march) => sum + march.capacity, 0);
        const availableByClass = this.countAvailableByClass(availableTroops);
        const totalAvailable = TROOP_TYPES.reduce((sum, type) => sum + availableByClass[type], 0);

        if (totalAvailable < totalCapacity) {
            throw new Error("errors.notEnoughTroops");
        }

        const topTwoAvailable = this.countTopTwoTiers(availableTroops);
        const mode: FillMode = topTwoAvailable >= totalCapacity ? "ratio" : "damage";

        let selectedGroups: TroopGroup[];
        let classTargets: TroopClassAmounts;
        let perMarchClassTargets: TroopClassAmounts[];

        if (mode === "ratio") {
            classTargets = this.calculateRatioClassTargets(
                totalCapacity,
                targetRatio,
                availableByClass
            );

            selectedGroups = this.selectByRatio(
                availableTroops,
                classTargets,
                tgLevels,
                armyStats
            );

            perMarchClassTargets = this.distributeClassTotals(
                classTargets,
                marchPlans.map((march) => march.capacity)
            );
        } else {
            const minimums = marchPlans.map((march) => this.minimumForMarch(march.capacity));
            const damageSelection = this.selectByDamage(
                availableTroops,
                totalCapacity,
                minimums,
                tgLevels,
                armyStats
            );

            selectedGroups = damageSelection.groups;
            classTargets = damageSelection.classTargets;
            perMarchClassTargets = this.distributeClassTotals(
                classTargets,
                marchPlans.map((march) => march.capacity),
                minimums
            );
        }

        const formations = this.distributeGroupsToMarches(
            selectedGroups,
            perMarchClassTargets
        );

        this.validateMarches(formations, marchPlans, mode);

        const hostIndex = marchPlans.findIndex((march) => march.kind === "host");
        const joinIndex = marchPlans.findIndex((march) => march.kind === "join");

        return {
            hostFormation: hostIndex >= 0 ? formations[hostIndex] : new Composition(),
            joinFormation: joinIndex >= 0 ? formations[joinIndex] : new Composition(),
            mode
        };
    }

    private static createMarchPlans(
        hostCapacity: number,
        joinerCapacity: number,
        joinerCount: number,
        hostOwn: boolean
    ): MarchPlan[] {
        const safeJoinerCount = Math.max(0, Math.floor(joinerCount));
        const plans: MarchPlan[] = [];

        if (hostOwn) {
            if (hostCapacity <= 0) {
                throw new Error("errors.invalidMarchCapacity");
            }
            plans.push({ kind: "host", capacity: Math.floor(hostCapacity) });
        }

        if (safeJoinerCount > 0) {
            if (joinerCapacity <= 0) {
                throw new Error("errors.invalidMarchCapacity");
            }
            for (let i = 0; i < safeJoinerCount; i++) {
                plans.push({ kind: "join", capacity: Math.floor(joinerCapacity) });
            }
        }

        if (plans.length === 0) {
            throw new Error("errors.marchCountGreaterThanZero");
        }

        return plans;
    }

    private static countAvailableByClass(troops: TroopComposition): TroopClassAmounts {
        return {
            infantry: troops.getClassTotal("infantry"),
            cavalry: troops.getClassTotal("cavalry"),
            archer: troops.getClassTotal("archer")
        };
    }

    private static countTopTwoTiers(troops: TroopComposition): number {
        let total = 0;
        for (const type of TROOP_TYPES) {
            for (const tiers of Object.values(troops[type])) {
                if (!tiers) continue;
                total += tiers.T10 ?? 0;
                total += tiers.T9 ?? 0;
            }
        }
        return total;
    }

    /**
     * Ratio mode: use the requested ratio unless availability makes it impossible.
     * If one class runs out, its share is redistributed proportionally between
     * the remaining classes.
     */
    private static calculateRatioClassTargets(
        totalCapacity: number,
        ratio: TargetRatio,
        available: TroopClassAmounts
    ): TroopClassAmounts {
        const normalized = this.normalizeRatio(ratio);
        const result = emptyAmounts();
        const remainingTypes = new Set<TroopType>(TROOP_TYPES);
        let remainingCapacity = totalCapacity;

        while (remainingCapacity > 0 && remainingTypes.size > 0) {
            let ratioSum = 0;
            for (const type of remainingTypes) {
                ratioSum += normalized[type];
            }

            if (ratioSum <= 0) {
                throw new Error("errors.invalidTargetRatio");
            }

            let limitedType: TroopType | null = null;

            for (const type of remainingTypes) {
                const wanted = remainingCapacity * normalized[type] / ratioSum;
                const availableLeft = available[type] - result[type];
                if (availableLeft + 1e-9 < wanted) {
                    limitedType = type;
                    break;
                }
            }

            if (limitedType !== null) {
                const amount = Math.max(0, available[limitedType] - result[limitedType]);
                result[limitedType] += amount;
                remainingCapacity -= amount;
                remainingTypes.delete(limitedType);
                continue;
            }

            for (const type of remainingTypes) {
                result[type] += remainingCapacity * normalized[type] / ratioSum;
            }
            remainingCapacity = 0;
        }

        return this.roundClassAmounts(result, available, totalCapacity);
    }

    private static selectByRatio(
        availableTroops: TroopComposition,
        targets: TroopClassAmounts,
        tgLevels: ClassTgLevels,
        armyStats: ArmyStats
    ): TroopGroup[] {
        const selected: TroopGroup[] = [];

        for (const type of TROOP_TYPES) {
            let remaining = targets[type];
            const tg = tgLevels[type];

            // Ratio mode deliberately ignores attack×lethality ordering.
            // It simply takes the highest tier first within each class.
            for (const tier of TIERS_DESC) {
                if (remaining <= 0) break;

                const amount = availableTroops.getTroops(type, tg, tier);
                if (amount <= 0) continue;

                const used = Math.min(amount, remaining);
                const stats = armyStats.type[type].tg[tg]?.[tier];
                if (!stats) continue;

                selected.push({
                    type,
                    tg,
                    tier,
                    amount: used,
                    stats,
                    damage: stats.attack * stats.lethality
                });
                remaining -= used;
            }

            if (remaining > 0) {
                throw new Error(`errors.notEnoughClass:${type}`);
            }
        }

        return selected;
    }

    /**
     * Damage mode:
     * 1) reserve >=10% of every march for every class,
     * 2) within each class use its strongest available tiers for that reserve,
     * 3) fill every remaining slot globally by attack × lethality, highest first.
     */
    private static selectByDamage(
        availableTroops: TroopComposition,
        totalCapacity: number,
        minimums: TroopClassAmounts[],
        tgLevels: ClassTgLevels,
        armyStats: ArmyStats
    ): { groups: TroopGroup[]; classTargets: TroopClassAmounts } {
        const pool = this.buildAvailableGroups(availableTroops, tgLevels, armyStats);
        const selected: TroopGroup[] = [];
        const globalMinimum = minimums.reduce<TroopClassAmounts>(
            (sum, min) => ({
                infantry: sum.infantry + min.infantry,
                cavalry: sum.cavalry + min.cavalry,
                archer: sum.archer + min.archer
            }),
            emptyAmounts()
        );

        const availableByClass = this.countAvailableByClass(availableTroops);
        for (const type of TROOP_TYPES) {
            if (availableByClass[type] < globalMinimum[type]) {
                throw new Error(`errors.notEnoughForMinimum:${type}`);
            }
        }

        // Reserve the 10% minimum from the strongest troops of each class.
        for (const type of TROOP_TYPES) {
            let remaining = globalMinimum[type];
            const candidates = pool
                .filter((group) => group.type === type && group.amount > 0)
                .sort((a, b) => this.compareGroupsByDamage(b, a));

            for (const group of candidates) {
                if (remaining <= 0) break;
                const used = Math.min(group.amount, remaining);
                this.addSelectedGroup(selected, group, used);
                group.amount -= used;
                remaining -= used;
            }
        }

        let remainingSlots = totalCapacity - selected.reduce((sum, group) => sum + group.amount, 0);

        const damageOrder = pool
            .filter((group) => group.amount > 0)
            .sort((a, b) => this.compareGroupsByDamage(b, a));

        for (const group of damageOrder) {
            if (remainingSlots <= 0) break;
            const used = Math.min(group.amount, remainingSlots);
            this.addSelectedGroup(selected, group, used);
            group.amount -= used;
            remainingSlots -= used;
        }

        if (remainingSlots > 0) {
            throw new Error("errors.notEnoughTroops");
        }

        const classTargets = emptyAmounts();
        for (const group of selected) {
            classTargets[group.type] += group.amount;
        }

        return { groups: selected, classTargets };
    }

    private static buildAvailableGroups(
        troops: TroopComposition,
        tgLevels: ClassTgLevels,
        armyStats: ArmyStats
    ): TroopGroup[] {
        const groups: TroopGroup[] = [];

        for (const type of TROOP_TYPES) {
            const tg = tgLevels[type];
            for (const tier of TIERS_DESC) {
                const amount = troops.getTroops(type, tg, tier);
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

        return groups;
    }

    private static addSelectedGroup(
        selected: TroopGroup[],
        source: TroopGroup,
        amount: number
    ): void {
        if (amount <= 0) return;
        const existing = selected.find((group) =>
            group.type === source.type
            && group.tg === source.tg
            && group.tier === source.tier
        );

        if (existing) {
            existing.amount += amount;
            return;
        }

        selected.push({ ...source, amount });
    }

    private static compareGroupsByDamage(a: TroopGroup, b: TroopGroup): number {
        if (a.damage !== b.damage) {
            return a.damage - b.damage;
        }
        return this.tierRank(a.tier) - this.tierRank(b.tier);
    }

    private static tierRank(tier: TierName): number {
        return Number.parseInt(tier.slice(1), 10);
    }

    private static minimumForMarch(capacity: number): TroopClassAmounts {
        const min = Math.ceil(capacity * MIN_CLASS_SHARE_DAMAGE_MODE);
        if (min * TROOP_TYPES.length > capacity) {
            throw new Error("errors.invalidMarchCapacity");
        }
        return { infantry: min, cavalry: min, archer: min };
    }

    /**
     * Distributes global class totals proportionally over differently-sized marches.
     * Optional per-march minimums are applied first (damage mode).
     */
    private static distributeClassTotals(
        classTotals: TroopClassAmounts,
        capacities: number[],
        minimums?: TroopClassAmounts[]
    ): TroopClassAmounts[] {
        const result = capacities.map((_, index) => minimums?.[index]
            ? { ...minimums[index] }
            : emptyAmounts()
        );

        const allocatedMinimum = result.reduce<TroopClassAmounts>(
            (sum, values) => ({
                infantry: sum.infantry + values.infantry,
                cavalry: sum.cavalry + values.cavalry,
                archer: sum.archer + values.archer
            }),
            emptyAmounts()
        );

        const remainingClass: TroopClassAmounts = {
            infantry: classTotals.infantry - allocatedMinimum.infantry,
            cavalry: classTotals.cavalry - allocatedMinimum.cavalry,
            archer: classTotals.archer - allocatedMinimum.archer
        };

        const remainingCaps = capacities.map((capacity, index) =>
            capacity
            - result[index].infantry
            - result[index].cavalry
            - result[index].archer
        );

        for (let i = 0; i < capacities.length; i++) {
            const capacityLeft = remainingCaps[i];
            if (capacityLeft <= 0) continue;

            const remainingTotalCap = remainingCaps
                .slice(i)
                .reduce((sum, value) => sum + value, 0);

            if (i === capacities.length - 1) {
                for (const type of TROOP_TYPES) {
                    result[i][type] += remainingClass[type];
                    remainingClass[type] = 0;
                }
                continue;
            }

            const allocation = this.allocateByProportion(
                capacityLeft,
                remainingClass,
                remainingTotalCap
            );

            for (const type of TROOP_TYPES) {
                result[i][type] += allocation[type];
                remainingClass[type] -= allocation[type];
            }
        }

        return result;
    }

    private static allocateByProportion(
        capacity: number,
        amounts: TroopClassAmounts,
        totalReference?: number
    ): TroopClassAmounts {
        const total = totalReference ?? TROOP_TYPES.reduce((sum, type) => sum + amounts[type], 0);
        if (capacity <= 0 || total <= 0) {
            return emptyAmounts();
        }

        const exact: Record<TroopType, number> = {
            infantry: capacity * amounts.infantry / total,
            cavalry: capacity * amounts.cavalry / total,
            archer: capacity * amounts.archer / total
        };

        const result: TroopClassAmounts = {
            infantry: Math.min(amounts.infantry, Math.floor(exact.infantry)),
            cavalry: Math.min(amounts.cavalry, Math.floor(exact.cavalry)),
            archer: Math.min(amounts.archer, Math.floor(exact.archer))
        };

        let missing = capacity - TROOP_TYPES.reduce((sum, type) => sum + result[type], 0);

        while (missing > 0) {
            const candidate = [...TROOP_TYPES]
                .filter((type) => result[type] < amounts[type])
                .sort((a, b) =>
                    (exact[b] - Math.floor(exact[b]))
                    - (exact[a] - Math.floor(exact[a]))
                )[0];

            if (!candidate) {
                break;
            }

            result[candidate] += 1;
            missing -= 1;
        }

        return result;
    }

    private static distributeGroupsToMarches(
        groups: TroopGroup[],
        classTargets: TroopClassAmounts[]
    ): TroopComposition[] {
        const formations = classTargets.map(() => new Composition());

        for (const type of TROOP_TYPES) {
            const needs = classTargets.map((target) => target[type]);
            const typeGroups = groups
                .filter((group) => group.type === type)
                .sort((a, b) => this.compareGroupsByDamage(b, a));

            for (const group of typeGroups) {
                const allocation = this.allocateAcrossNeeds(group.amount, needs);

                for (let i = 0; i < allocation.length; i++) {
                    const amount = allocation[i];
                    if (amount <= 0) continue;

                    formations[i].addTroops(type, group.tg, group.tier, amount);
                    needs[i] -= amount;
                }
            }

            if (needs.some((need) => need !== 0)) {
                throw new Error("errors.calculation");
            }
        }

        return formations;
    }

    private static allocateAcrossNeeds(amount: number, needs: number[]): number[] {
        const totalNeed = needs.reduce((sum, value) => sum + value, 0);
        if (amount <= 0 || totalNeed <= 0) {
            return needs.map(() => 0);
        }

        const exact = needs.map((need) => amount * need / totalNeed);
        const result = exact.map((value, index) => Math.min(needs[index], Math.floor(value)));
        let missing = amount - result.reduce((sum, value) => sum + value, 0);

        while (missing > 0) {
            let bestIndex = -1;
            let bestFraction = Number.NEGATIVE_INFINITY;

            for (let i = 0; i < needs.length; i++) {
                if (result[i] >= needs[i]) continue;
                const fraction = exact[i] - Math.floor(exact[i]);
                if (fraction > bestFraction) {
                    bestFraction = fraction;
                    bestIndex = i;
                }
            }

            if (bestIndex < 0) break;
            result[bestIndex] += 1;
            missing -= 1;
        }

        return result;
    }

    private static roundClassAmounts(
        targets: TroopClassAmounts,
        available: TroopClassAmounts,
        totalCapacity: number
    ): TroopClassAmounts {
        const result: TroopClassAmounts = {
            infantry: Math.floor(targets.infantry),
            cavalry: Math.floor(targets.cavalry),
            archer: Math.floor(targets.archer)
        };

        let missing = totalCapacity - TROOP_TYPES.reduce((sum, type) => sum + result[type], 0);

        while (missing > 0) {
            const candidate = [...TROOP_TYPES]
                .filter((type) => result[type] < available[type])
                .sort((a, b) =>
                    (targets[b] - Math.floor(targets[b]))
                    - (targets[a] - Math.floor(targets[a]))
                )[0];

            if (!candidate) {
                throw new Error("errors.notEnoughTroops");
            }

            result[candidate] += 1;
            missing -= 1;
        }

        return result;
    }

    private static normalizeRatio(ratio: TargetRatio): TargetRatio {
        const safe: TargetRatio = {
            infantry: Math.max(0, ratio.infantry),
            cavalry: Math.max(0, ratio.cavalry),
            archer: Math.max(0, ratio.archer)
        };
        const total = safe.infantry + safe.cavalry + safe.archer;

        if (total <= 0) {
            throw new Error("errors.invalidTargetRatio");
        }

        return {
            infantry: safe.infantry / total,
            cavalry: safe.cavalry / total,
            archer: safe.archer / total
        };
    }

    private static validateMarches(
        formations: TroopComposition[],
        plans: MarchPlan[],
        mode: FillMode
    ): void {
        formations.forEach((formation, index) => {
            if (formation.getTotal() !== plans[index].capacity) {
                throw new Error("errors.calculation");
            }

            if (mode === "damage") {
                const required = Math.ceil(plans[index].capacity * MIN_CLASS_SHARE_DAMAGE_MODE);
                for (const type of TROOP_TYPES) {
                    if (formation.getClassTotal(type) < required) {
                        throw new Error("errors.calculation");
                    }
                }
            }
        });
    }
}
