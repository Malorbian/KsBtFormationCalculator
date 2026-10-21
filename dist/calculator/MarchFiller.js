import { TroopComposition as Composition } from "./TroopComposition.js";
import { TIERS_DESC, TROOP_TYPES } from "./types.js";
const MIN_CLASS_SHARE_DAMAGE_MODE = 0.10;
function emptyAmounts() {
    return { infantry: 0, cavalry: 0, archer: 0 };
}
export class MarchFiller {
    static fill(availableTroops, targetRatio, hostCapacity, joinerCapacity, joinerCount, hostOwn, tgLevels, armyStats) {
        const marchPlans = this.createMarchPlans(hostCapacity, joinerCapacity, joinerCount, hostOwn);
        const requestedTotalCapacity = marchPlans.reduce((sum, march) => sum + march.capacity, 0);
        const availableByClass = this.countAvailableByClass(availableTroops);
        const totalAvailable = TROOP_TYPES.reduce((sum, type) => sum + availableByClass[type], 0);
        // A player may own fewer troops than the combined capacity of all selected
        // marches. In that case we still calculate formations instead of aborting.
        // The available troops are spread proportionally over all selected marches.
        const topTwoAvailable = this.countTopTwoTiers(availableTroops);
        const mode = topTwoAvailable >= requestedTotalCapacity ? "ratio" : "damage";
        let totalToDeploy = Math.min(totalAvailable, requestedTotalCapacity);
        // Damage mode requires at least 10% of every used march to be present in
        // each troop class. If one class is scarce, reduce the overall amount sent
        // just enough to keep that rule valid rather than failing the calculation.
        if (mode === "damage") {
            totalToDeploy = this.limitDamageModeDeploymentByMinimums(marchPlans, totalToDeploy, availableByClass);
        }
        const effectiveMarchPlans = this.scaleMarchPlansToAvailableTroops(marchPlans, totalToDeploy);
        if (totalToDeploy <= 0) {
            return {
                hostFormation: new Composition(),
                joinFormation: new Composition(),
                mode
            };
        }
        let selectedGroups;
        let classTargets;
        let perMarchClassTargets;
        if (mode === "ratio") {
            classTargets = this.calculateRatioClassTargets(totalToDeploy, targetRatio, availableByClass);
            selectedGroups = this.selectByRatio(availableTroops, classTargets, tgLevels, armyStats);
            perMarchClassTargets = this.distributeClassTotals(classTargets, effectiveMarchPlans.map((march) => march.capacity));
        }
        else {
            const minimums = effectiveMarchPlans.map((march) => this.minimumForMarch(march.capacity));
            const damageSelection = this.selectByDamage(availableTroops, totalToDeploy, minimums, tgLevels, armyStats);
            selectedGroups = damageSelection.groups;
            classTargets = damageSelection.classTargets;
            perMarchClassTargets = this.distributeClassTotals(classTargets, effectiveMarchPlans.map((march) => march.capacity), minimums);
        }
        const formations = this.distributeGroupsToMarches(selectedGroups, perMarchClassTargets);
        this.validateMarches(formations, effectiveMarchPlans, mode);
        const hostIndex = effectiveMarchPlans.findIndex((march) => march.kind === "host");
        const joinIndex = effectiveMarchPlans.findIndex((march) => march.kind === "join");
        return {
            hostFormation: hostIndex >= 0 ? formations[hostIndex] : new Composition(),
            joinFormation: joinIndex >= 0 ? formations[joinIndex] : new Composition(),
            mode
        };
    }
    static createMarchPlans(hostCapacity, joinerCapacity, joinerCount, hostOwn) {
        const safeJoinerCount = Math.max(0, Math.floor(joinerCount));
        const plans = [];
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
    /**
     * If there are fewer troops than total march capacity, scale every selected
     * march by the same fill percentage. The returned capacities are integers,
     * never exceed the requested capacities, and sum exactly to totalToDeploy.
     *
     * Example: 120k host + five 90k joins = 570k capacity. With only 285k
     * troops available, the effective formations become 60k host + five 45k joins.
     */
    static scaleMarchPlansToAvailableTroops(plans, totalToDeploy) {
        const requestedTotal = plans.reduce((sum, plan) => sum + plan.capacity, 0);
        const safeTotal = Math.max(0, Math.min(Math.floor(totalToDeploy), requestedTotal));
        if (safeTotal >= requestedTotal) {
            return plans.map((plan) => ({ ...plan }));
        }
        if (safeTotal === 0 || requestedTotal === 0) {
            return plans.map((plan) => ({ ...plan, capacity: 0 }));
        }
        const exact = plans.map((plan) => safeTotal * plan.capacity / requestedTotal);
        const capacities = exact.map((value, index) => Math.min(plans[index].capacity, Math.floor(value)));
        let missing = safeTotal - capacities.reduce((sum, value) => sum + value, 0);
        // Largest-remainder rounding keeps the distribution as proportional as
        // possible while making the sum exactly match the number of troops used.
        const order = exact
            .map((value, index) => ({
            index,
            fraction: value - Math.floor(value)
        }))
            .sort((a, b) => b.fraction - a.fraction);
        while (missing > 0) {
            let added = false;
            for (const entry of order) {
                if (missing <= 0)
                    break;
                if (capacities[entry.index] >= plans[entry.index].capacity)
                    continue;
                capacities[entry.index] += 1;
                missing -= 1;
                added = true;
            }
            if (!added)
                break;
        }
        return plans.map((plan, index) => ({
            ...plan,
            capacity: capacities[index]
        }));
    }
    /**
     * Returns the largest deployable troop count (up to requestedAmount) for which
     * the damage-mode 10% minimum can still be satisfied for infantry, cavalry
     * and archers in every non-empty march.
     */
    static limitDamageModeDeploymentByMinimums(plans, requestedAmount, available) {
        if (requestedAmount <= 0)
            return 0;
        // Globally, a 10% minimum means no class can support a formation larger
        // than roughly 10x its available troop count. This gives us a close upper
        // bound before accounting for per-march integer rounding.
        const smallestClass = Math.min(available.infantry, available.cavalry, available.archer);
        let candidate = Math.min(Math.floor(requestedAmount), Math.floor(smallestClass / MIN_CLASS_SHARE_DAMAGE_MODE));
        while (candidate > 0) {
            const scaledPlans = this.scaleMarchPlansToAvailableTroops(plans, candidate);
            const minimums = scaledPlans.map((plan) => this.minimumForMarch(plan.capacity));
            const required = minimums.reduce((sum, min) => ({
                infantry: sum.infantry + min.infantry,
                cavalry: sum.cavalry + min.cavalry,
                archer: sum.archer + min.archer
            }), emptyAmounts());
            if (TROOP_TYPES.every((type) => available[type] >= required[type])) {
                return candidate;
            }
            candidate -= 1;
        }
        return 0;
    }
    static countAvailableByClass(troops) {
        return {
            infantry: troops.getClassTotal("infantry"),
            cavalry: troops.getClassTotal("cavalry"),
            archer: troops.getClassTotal("archer")
        };
    }
    static countTopTwoTiers(troops) {
        let total = 0;
        for (const type of TROOP_TYPES) {
            for (const tiers of Object.values(troops[type])) {
                if (!tiers)
                    continue;
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
    static calculateRatioClassTargets(totalCapacity, ratio, available) {
        const normalized = this.normalizeRatio(ratio);
        const result = emptyAmounts();
        const remainingTypes = new Set(TROOP_TYPES);
        let remainingCapacity = totalCapacity;
        while (remainingCapacity > 0 && remainingTypes.size > 0) {
            let ratioSum = 0;
            for (const type of remainingTypes) {
                ratioSum += normalized[type];
            }
            if (ratioSum <= 0) {
                throw new Error("errors.invalidTargetRatio");
            }
            let limitedType = null;
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
    static selectByRatio(availableTroops, targets, tgLevels, armyStats) {
        const selected = [];
        for (const type of TROOP_TYPES) {
            let remaining = targets[type];
            const tg = tgLevels[type];
            // Ratio mode deliberately ignores attack×lethality ordering.
            // It simply takes the highest tier first within each class.
            for (const tier of TIERS_DESC) {
                if (remaining <= 0)
                    break;
                const amount = availableTroops.getTroops(type, tg, tier);
                if (amount <= 0)
                    continue;
                const used = Math.min(amount, remaining);
                const stats = armyStats.type[type].tg[tg]?.[tier];
                if (!stats)
                    continue;
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
    static selectByDamage(availableTroops, totalCapacity, minimums, tgLevels, armyStats) {
        const pool = this.buildAvailableGroups(availableTroops, tgLevels, armyStats);
        const selected = [];
        const globalMinimum = minimums.reduce((sum, min) => ({
            infantry: sum.infantry + min.infantry,
            cavalry: sum.cavalry + min.cavalry,
            archer: sum.archer + min.archer
        }), emptyAmounts());
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
                if (remaining <= 0)
                    break;
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
            if (remainingSlots <= 0)
                break;
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
    static buildAvailableGroups(troops, tgLevels, armyStats) {
        const groups = [];
        for (const type of TROOP_TYPES) {
            const tg = tgLevels[type];
            for (const tier of TIERS_DESC) {
                const amount = troops.getTroops(type, tg, tier);
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
        return groups;
    }
    static addSelectedGroup(selected, source, amount) {
        if (amount <= 0)
            return;
        const existing = selected.find((group) => group.type === source.type
            && group.tg === source.tg
            && group.tier === source.tier);
        if (existing) {
            existing.amount += amount;
            return;
        }
        selected.push({ ...source, amount });
    }
    static compareGroupsByDamage(a, b) {
        if (a.damage !== b.damage) {
            return a.damage - b.damage;
        }
        return this.tierRank(a.tier) - this.tierRank(b.tier);
    }
    static tierRank(tier) {
        return Number.parseInt(tier.slice(1), 10);
    }
    static minimumForMarch(capacity) {
        if (capacity <= 0) {
            return emptyAmounts();
        }
        // With only one or two troops it is mathematically impossible to place
        // at least one troop of all three classes. Do not fail the whole
        // calculation for this extreme low-troop edge case.
        if (capacity < TROOP_TYPES.length) {
            return emptyAmounts();
        }
        const min = Math.ceil(capacity * MIN_CLASS_SHARE_DAMAGE_MODE);
        return { infantry: min, cavalry: min, archer: min };
    }
    /**
     * Distributes global class totals proportionally over differently-sized marches.
     * Optional per-march minimums are applied first (damage mode).
     */
    static distributeClassTotals(classTotals, capacities, minimums) {
        const result = capacities.map((_, index) => minimums?.[index]
            ? { ...minimums[index] }
            : emptyAmounts());
        const allocatedMinimum = result.reduce((sum, values) => ({
            infantry: sum.infantry + values.infantry,
            cavalry: sum.cavalry + values.cavalry,
            archer: sum.archer + values.archer
        }), emptyAmounts());
        const remainingClass = {
            infantry: classTotals.infantry - allocatedMinimum.infantry,
            cavalry: classTotals.cavalry - allocatedMinimum.cavalry,
            archer: classTotals.archer - allocatedMinimum.archer
        };
        const remainingCaps = capacities.map((capacity, index) => capacity
            - result[index].infantry
            - result[index].cavalry
            - result[index].archer);
        for (let i = 0; i < capacities.length; i++) {
            const capacityLeft = remainingCaps[i];
            if (capacityLeft <= 0)
                continue;
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
            const allocation = this.allocateByProportion(capacityLeft, remainingClass, remainingTotalCap);
            for (const type of TROOP_TYPES) {
                result[i][type] += allocation[type];
                remainingClass[type] -= allocation[type];
            }
        }
        return result;
    }
    static allocateByProportion(capacity, amounts, totalReference) {
        const total = totalReference ?? TROOP_TYPES.reduce((sum, type) => sum + amounts[type], 0);
        if (capacity <= 0 || total <= 0) {
            return emptyAmounts();
        }
        const exact = {
            infantry: capacity * amounts.infantry / total,
            cavalry: capacity * amounts.cavalry / total,
            archer: capacity * amounts.archer / total
        };
        const result = {
            infantry: Math.min(amounts.infantry, Math.floor(exact.infantry)),
            cavalry: Math.min(amounts.cavalry, Math.floor(exact.cavalry)),
            archer: Math.min(amounts.archer, Math.floor(exact.archer))
        };
        let missing = capacity - TROOP_TYPES.reduce((sum, type) => sum + result[type], 0);
        while (missing > 0) {
            const candidate = [...TROOP_TYPES]
                .filter((type) => result[type] < amounts[type])
                .sort((a, b) => (exact[b] - Math.floor(exact[b]))
                - (exact[a] - Math.floor(exact[a])))[0];
            if (!candidate) {
                break;
            }
            result[candidate] += 1;
            missing -= 1;
        }
        return result;
    }
    static distributeGroupsToMarches(groups, classTargets) {
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
                    if (amount <= 0)
                        continue;
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
    static allocateAcrossNeeds(amount, needs) {
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
                if (result[i] >= needs[i])
                    continue;
                const fraction = exact[i] - Math.floor(exact[i]);
                if (fraction > bestFraction) {
                    bestFraction = fraction;
                    bestIndex = i;
                }
            }
            if (bestIndex < 0)
                break;
            result[bestIndex] += 1;
            missing -= 1;
        }
        return result;
    }
    static roundClassAmounts(targets, available, totalCapacity) {
        const result = {
            infantry: Math.floor(targets.infantry),
            cavalry: Math.floor(targets.cavalry),
            archer: Math.floor(targets.archer)
        };
        let missing = totalCapacity - TROOP_TYPES.reduce((sum, type) => sum + result[type], 0);
        while (missing > 0) {
            const candidate = [...TROOP_TYPES]
                .filter((type) => result[type] < available[type])
                .sort((a, b) => (targets[b] - Math.floor(targets[b]))
                - (targets[a] - Math.floor(targets[a])))[0];
            if (!candidate) {
                throw new Error("errors.notEnoughTroops");
            }
            result[candidate] += 1;
            missing -= 1;
        }
        return result;
    }
    static normalizeRatio(ratio) {
        const safe = {
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
    static validateMarches(formations, plans, mode) {
        formations.forEach((formation, index) => {
            if (formation.getTotal() !== plans[index].capacity) {
                throw new Error("errors.calculation");
            }
            if (mode === "damage") {
                const required = this.minimumForMarch(plans[index].capacity);
                for (const type of TROOP_TYPES) {
                    if (formation.getClassTotal(type) < required[type]) {
                        throw new Error("errors.calculation");
                    }
                }
            }
        });
    }
}
