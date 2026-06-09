"use strict";
class Tier {
    constructor(name, infantry, cavalry, archers) {
        this.name = name;
        this.infantry = infantry;
        this.cavalry = cavalry;
        this.archers = archers;
        this.name = name;
        this.infantry = infantry;
        this.cavalry = cavalry;
        this.archers = archers;
    }
    getTotal() {
        return this.infantry + this.cavalry + this.archers;
    }
    add(other, factor) {
        const f = factor !== undefined ? factor : 1;
        this.infantry += other.infantry * f;
        this.cavalry += other.cavalry * f;
        this.archers += other.archers * f;
    }
}
class TroopComposition {
    constructor(name, T8, T9, T10) {
        this.name = name;
        this.T8 = T8;
        this.T9 = T9;
        this.T10 = T10;
    }
    getTotal() {
        return this.T8.getTotal() + this.T9.getTotal() + this.T10.getTotal();
    }
    getTroopTypeTotal(tiers, troopType) {
        return tiers["T8"][troopType]
            + tiers["T9"][troopType]
            + tiers["T10"][troopType];
    }
    calculateFormations(marchCount, marchCap, joinCap, hostOwn) {
        const divisor = marchCount + (hostOwn ? 1 : 0);
        if (divisor <= 0) {
            throw new Error("March count must be greater than 0.");
        }
        const joinTiers = {
            T8: new Tier("T8", Math.ceil(this.T8.infantry / divisor), Math.ceil(this.T8.cavalry / divisor), Math.ceil(this.T8.archers / divisor)),
            T9: new Tier("T9", Math.ceil(this.T9.infantry / divisor), Math.ceil(this.T9.cavalry / divisor), Math.ceil(this.T9.archers / divisor)),
            T10: new Tier("T10", Math.ceil(this.T10.infantry / divisor), Math.ceil(this.T10.cavalry / divisor), Math.ceil(this.T10.archers / divisor))
        };
        const removedTiers = {
            T8: new Tier("T8", 0, 0, 0),
            T9: new Tier("T9", 0, 0, 0),
            T10: new Tier("T10", 0, 0, 0)
        };
        this.trimToCap(joinTiers, joinCap, removedTiers);
        const hostTiers = {
            T8: new Tier("T8", joinTiers.T8.infantry, joinTiers.T8.cavalry, joinTiers.T8.archers),
            T9: new Tier("T9", joinTiers.T9.infantry, joinTiers.T9.cavalry, joinTiers.T9.archers),
            T10: new Tier("T10", joinTiers.T10.infantry, joinTiers.T10.cavalry, joinTiers.T10.archers),
        };
        if (hostOwn) {
            hostTiers.T8.add(removedTiers.T8, divisor);
            hostTiers.T9.add(removedTiers.T9, divisor);
            hostTiers.T10.add(removedTiers.T10, divisor);
            this.trimToCap(hostTiers, marchCap);
        }
        return {
            joinFormation: TroopComposition.fromMutable("Join Formation", joinTiers),
            hostFormation: TroopComposition.fromMutable("Host Formation", hostTiers)
        };
    }
    trimToCap(tiers, cap, removedTarget) {
        const removeOrder = [
            ["T8", "infantry"],
            ["T8", "cavalry"],
            ["T9", "infantry"],
            ["T9", "cavalry"],
            ["T10", "infantry"],
            ["T10", "cavalry"],
            ["T8", "archers"],
            ["T9", "archers"],
            ["T10", "archers"]
        ];
        let currentCount = this.getMutableTotal(tiers);
        if (currentCount <= cap) {
            return;
        }
        let toRemove = currentCount - cap;
        const minTroopsPerType = cap >= 100 ? Math.ceil(cap * 0.1) : 0;
        while (toRemove > 0) {
            let removedSomething = false;
            for (const [tierName, troopType] of removeOrder) {
                if (toRemove <= 0)
                    break;
                const tier = tiers[tierName];
                const currentTroopTypeTotal = this.getTroopTypeTotal(tiers, troopType);
                const removableFromType = currentTroopTypeTotal - minTroopsPerType;
                const removableFromTier = Math.min(tier[troopType], removableFromType, toRemove);
                if (removableFromTier <= 0)
                    continue;
                tier[troopType] -= removableFromTier;
                if (removedTarget) {
                    removedTarget[tierName][troopType] += removableFromTier;
                }
                toRemove -= removableFromTier;
                removedSomething = true;
            }
            if (!removedSomething) {
                break;
            }
        }
    }
    getMutableTotal(tiers) {
        return tiers.T8.getTotal() + tiers.T9.getTotal() + tiers.T10.getTotal();
    }
    static fromMutable(name, tiers) {
        return new TroopComposition(name, tiers.T8, tiers.T9, tiers.T10);
    }
}
// --- UI binding ---------------------------------------------------------
function readInt(id, fallback = 0) {
    const el = document.getElementById(id);
    if (!el)
        return fallback;
    const v = parseInt(el.value, 10);
    return Number.isFinite(v) ? v : fallback;
}
function readBool(id) {
    const el = document.getElementById(id);
    return !!(el && el.checked);
}
function setOutput(id, value) {
    const el = document.getElementById(id);
    if (!el)
        return;
    el.value = String(value);
}
function calculateAndFillOutputs() {
    const t10Inf = readInt('t10-infantry', 0);
    const t10Cav = readInt('t10-cavalry', 0);
    const t10Arc = readInt('t10-archer', 0);
    const t9Inf = readInt('t9-infantry', 0);
    const t9Cav = readInt('t9-cavalry', 0);
    const t9Arc = readInt('t9-archer', 0);
    const t8Inf = readInt('t8-infantry', 0);
    const t8Cav = readInt('t8-cavalry', 0);
    const t8Arc = readInt('t8-archer', 0);
    const marchCap = readInt('march-cap', 0);
    const joinCap = readInt('join-cap', 0);
    const marchCount = readInt('max-marches', 0);
    const hostOwn = readBool('host-own-rally');
    const host_comp = new TroopComposition('Input', new Tier('T8', t8Inf, t8Cav, t8Arc), new Tier('T9', t9Inf, t9Cav, t9Arc), new Tier('T10', t10Inf, t10Cav, t10Arc));
    const resultsEl = document.getElementById('results');
    try {
        const res = host_comp.calculateFormations(marchCount, marchCap, joinCap, hostOwn);
        // fill join outputs
        setOutput('join-t10-infantry', res.joinFormation.T10.infantry);
        setOutput('join-t10-cavalry', res.joinFormation.T10.cavalry);
        setOutput('join-t10-archer', res.joinFormation.T10.archers);
        setOutput('join-t9-infantry', res.joinFormation.T9.infantry);
        setOutput('join-t9-cavalry', res.joinFormation.T9.cavalry);
        setOutput('join-t9-archer', res.joinFormation.T9.archers);
        setOutput('join-t8-infantry', res.joinFormation.T8.infantry);
        setOutput('join-t8-cavalry', res.joinFormation.T8.cavalry);
        setOutput('join-t8-archer', res.joinFormation.T8.archers);
        // fill host outputs
        setOutput('host-t10-infantry', res.hostFormation.T10.infantry);
        setOutput('host-t10-cavalry', res.hostFormation.T10.cavalry);
        setOutput('host-t10-archer', res.hostFormation.T10.archers);
        setOutput('host-t9-infantry', res.hostFormation.T9.infantry);
        setOutput('host-t9-cavalry', res.hostFormation.T9.cavalry);
        setOutput('host-t9-archer', res.hostFormation.T9.archers);
        setOutput('host-t8-infantry', res.hostFormation.T8.infantry);
        setOutput('host-t8-cavalry', res.hostFormation.T8.cavalry);
        setOutput('host-t8-archer', res.hostFormation.T8.archers);
        if (resultsEl)
            resultsEl.textContent = 'Formations calculated.';
    }
    catch (err) {
        if (resultsEl)
            resultsEl.textContent = String(err.message || 'Calculation error');
    }
}
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('calculator-form');
    if (!form)
        return;
    // prevent form submit from clearing inputs / reloading page
    form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        calculateAndFillOutputs();
    });
    // also calculate live on input change without clearing
    form.addEventListener('input', () => {
        calculateAndFillOutputs();
    });
    // initial fill
    calculateAndFillOutputs();
});
