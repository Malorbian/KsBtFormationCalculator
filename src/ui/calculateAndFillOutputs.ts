import { MarchFiller } from "../calculator/MarchFiller.js";
import { RatioCalculation } from "../calculator/RatioCalculation.js";
import { TroopComposition } from "../calculator/TroopComposition.js";
import type {
    ArmyStats,
    BonusStats,
    ClassTgLevels,
    TargetRatio,
    TgLevel,
    TierName,
    TroopType
} from "../calculator/types.js";
import { DEFAULT_RATIO, TIERS_DESC, TROOP_TYPES } from "../calculator/types.js";
import { t } from "../language/index.js";
import { readBool, readInt, readOptionalNumber, readSelectValue, setOutput } from "./dom.js";

let armyStats: ArmyStats | null = null;

export function setArmyStats(stats: ArmyStats | null): void {
    armyStats = stats;
}

function readTgLevel(id: string): TgLevel {
    const value = readSelectValue(id);
    const allowed: TgLevel[] = ["TG0", "TG1", "TG2", "TG3", "TG4", "TG5"];
    return allowed.includes(value as TgLevel) ? value as TgLevel : "TG0";
}

function buildTroopComposition(tgLevels: ClassTgLevels): TroopComposition {
    const composition = new TroopComposition();

    for (const type of TROOP_TYPES) {
        const tg = tgLevels[type];
        for (const tier of TIERS_DESC) {
            const id = `${tier.toLowerCase()}-${type}`;
            composition.setTroops(type, tg, tier, Math.max(0, readInt(id, 0)));
        }
    }

    return composition;
}

function readCompleteBonusStats(): BonusStats | null {
    const ids: Record<TroopType, { attack: string; lethality: string }> = {
        infantry: {
            attack: "stats-infantry-attack",
            lethality: "stats-infantry-lethality"
        },
        cavalry: {
            attack: "stats-cavalry-attack",
            lethality: "stats-cavalry-lethality"
        },
        archer: {
            attack: "stats-archer-attack",
            lethality: "stats-archer-lethality"
        }
    };

    const values = {} as Record<TroopType, { attack: number | null; lethality: number | null }>;

    for (const type of TROOP_TYPES) {
        values[type] = {
            attack: readOptionalNumber(ids[type].attack),
            lethality: readOptionalNumber(ids[type].lethality)
        };

        if (values[type].attack === null || values[type].lethality === null) {
            return null;
        }
    }

    return {
        type: {
            infantry: {
                attack: values.infantry.attack!,
                lethality: values.infantry.lethality!
            },
            cavalry: {
                attack: values.cavalry.attack!,
                lethality: values.cavalry.lethality!
            },
            archer: {
                attack: values.archer.attack!,
                lethality: values.archer.lethality!
            }
        }
    };
}

function formatRatioPercent(value: number): string {
    const percent = value * 100;
    return Number.isInteger(percent) ? String(percent) : percent.toFixed(2);
}

function setRatioInputs(ratio: TargetRatio): void {
    setOutput("target-ratio-infantry", formatRatioPercent(ratio.infantry));
    setOutput("target-ratio-cavalry", formatRatioPercent(ratio.cavalry));
    setOutput("target-ratio-archer", formatRatioPercent(ratio.archer));
}

function readRatioInputs(): TargetRatio {
    const infantry = Math.max(0, readOptionalNumber("target-ratio-infantry") ?? 0);
    const cavalry = Math.max(0, readOptionalNumber("target-ratio-cavalry") ?? 0);
    const archer = Math.max(0, readOptionalNumber("target-ratio-archer") ?? 0);
    const total = infantry + cavalry + archer;

    if (!Number.isFinite(total) || total <= 0) {
        return { ...DEFAULT_RATIO };
    }

    return {
        infantry: infantry / total,
        cavalry: cavalry / total,
        archer: archer / total
    };
}

export function updateRatioFromStats(): void {
    if (!armyStats) {
        return;
    }

    const bonusStats = readCompleteBonusStats();

    // Do nothing until all 6 stat fields are filled.
    if (!bonusStats) {
        return;
    }

    const hostCapacity = Math.max(0, readInt("march-cap", 0));
    const joinCapacity = Math.max(0, readInt("join-cap", 0));
    const joinerCount = Math.max(4, Math.min(6, readInt("max-marches", 6)));
    const hostOwn = readBool("host-own-rally");

    const totalCapacity =
        joinCapacity * joinerCount
        + (hostOwn ? hostCapacity : 0);

    if (totalCapacity <= 0) {
        return;
    }

    const tgLevels: ClassTgLevels = {
        infantry: readTgLevel("tg-infantry"),
        cavalry: readTgLevel("tg-cavalry"),
        archer: readTgLevel("tg-archer")
    };

    const availableTroops =
        buildTroopComposition(tgLevels);

    availableTroops.calculateAverageTroopBaseStats(
        totalCapacity,
        armyStats
    );

    const ratio =
        RatioCalculation.calculateFromStats(
            bonusStats,
            availableTroops.averageTroopBaseStats,
            tgLevels
        );

    // This is the important part:
    // actually write the calculated ratio into the editable fields.
    setRatioInputs(ratio);
}

export function resetTargetRatioToDefault(): void {
    const useStats = document.getElementById("use-stats-ratio") as HTMLInputElement | null;
    if (useStats) {
        useStats.checked = false;
    }
    setRatioInputs(DEFAULT_RATIO);
}

function fillFormationOutputs(prefix: "join" | "host", formation: TroopComposition): void {
    for (const tier of TIERS_DESC) {
        const tierLower = tier.toLowerCase();
        setOutput(`${prefix}-${tierLower}-infantry`, formation.getTierTroops("infantry", tier));
        setOutput(`${prefix}-${tierLower}-cavalry`, formation.getTierTroops("cavalry", tier));
        setOutput(`${prefix}-${tierLower}-archer`, formation.getTierTroops("archer", tier));
    }
}

function clearFormationOutputs(): void {
    const empty = new TroopComposition();
    fillFormationOutputs("join", empty);
    fillFormationOutputs("host", empty);
}

function translateCalculationError(message: string): string {
    if (message.startsWith("errors.notEnoughClass:")) {
        const type = message.split(":")[1] as TroopType;
        return `${t("errors.notEnoughClass")} ${t(`troops.${type}`)}`;
    }

    if (message.startsWith("errors.notEnoughForMinimum:")) {
        const type = message.split(":")[1] as TroopType;
        return `${t("errors.notEnoughForMinimum")} ${t(`troops.${type}`)}`;
    }

    return t(message, message);
}

export function calculateAndFillOutputs(): void {
    const resultsEl = document.getElementById("results");

    if (!armyStats) {
        clearFormationOutputs();
        setRatioInputs(DEFAULT_RATIO);
        if (resultsEl) resultsEl.textContent = t("errors.statsNotLoaded");
        return;
    }

    const hostCapacity = Math.max(0, readInt("march-cap", 0));
    const joinCapacity = Math.max(0, readInt("join-cap", 0));
    const joinerCount = Math.max(4, Math.min(6, readInt("max-marches", 6)));
    const hostOwn = readBool("host-own-rally");

    const tgLevels: ClassTgLevels = {
        infantry: readTgLevel("tg-infantry"),
        cavalry: readTgLevel("tg-cavalry"),
        archer: readTgLevel("tg-archer")
    };

    const availableTroops = buildTroopComposition(tgLevels);
    const totalCapacity = joinCapacity * joinerCount + (hostOwn ? hostCapacity : 0);

    const useStatsForRatio =
        readBool("use-stats-ratio");

    if (useStatsForRatio) {

        const bonusStats =
            readCompleteBonusStats();

        if (bonusStats && totalCapacity > 0) {

            availableTroops
                .calculateAverageTroopBaseStats(
                    totalCapacity,
                    armyStats
                );

            const calculatedRatio =
                RatioCalculation.calculateFromStats(
                    bonusStats,
                    availableTroops.averageTroopBaseStats,
                    tgLevels
                );

            setRatioInputs(
                calculatedRatio
            );
        }
    }

    const targetRatio =
        readRatioInputs();

    try {
        const result = MarchFiller.fill(
            availableTroops,
            targetRatio,
            hostCapacity,
            joinCapacity,
            joinerCount,
            hostOwn,
            tgLevels,
            armyStats
        );

        fillFormationOutputs("join", result.joinFormation);
        fillFormationOutputs("host", result.hostFormation);

        if (resultsEl) {
            resultsEl.textContent = result.mode === "ratio"
                ? t("status.formationsCalculatedRatio")
                : t("status.formationsCalculatedDamage");
        }
    } catch (error) {
        clearFormationOutputs();
        if (resultsEl) {
            const message = error instanceof Error ? error.message : "errors.calculation";
            resultsEl.textContent = translateCalculationError(message);
        }
    }
}
