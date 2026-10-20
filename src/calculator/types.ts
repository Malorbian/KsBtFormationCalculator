import type { TroopComposition } from "./TroopComposition.js";

export type TierName = "T5" | "T6" | "T7" | "T8" | "T9" | "T10";
export type TroopType = "infantry" | "cavalry" | "archer";
export type TgLevel = "TG0" | "TG1" | "TG2" | "TG3" | "TG4" | "TG5";

export const TIERS_DESC: TierName[] = ["T10", "T9", "T8", "T7", "T6", "T5"];
export const TROOP_TYPES: TroopType[] = ["infantry", "cavalry", "archer"];

// Ratios are stored internally as fractions (0..1), not percentages.
export const DEFAULT_RATIO: TargetRatio = {
    infantry: 0.01,
    cavalry: 0.20,
    archer: 0.79
};

export interface TargetRatio {
    infantry: number;
    cavalry: number;
    archer: number;
}

export interface TroopClassAmounts {
    infantry: number;
    cavalry: number;
    archer: number;
}

export interface TroopStats {
    attack: number;
    defense: number;
    health: number;
    lethality: number;
}

export interface OffensiveBonusStats {
    attack: number;
    lethality: number;
}

export interface BonusStats {
    type: Record<TroopType, OffensiveBonusStats>;
}

export interface TroopTypeStats {
    tg: Record<TgLevel, Record<TierName, TroopStats>>;
}

export interface ArmyStats {
    type: Record<TroopType, TroopTypeStats>;
}

export interface AverageTroopStats {
    type: Record<TroopType, TroopStats>;
}

export interface TroopGroup {
    type: TroopType;
    tg: TgLevel;
    tier: TierName;
    amount: number;
    stats: TroopStats;
    damage: number;
}

export type ClassTgLevels = Record<TroopType, TgLevel>;
export type FillMode = "ratio" | "damage";

export interface FormationResult {
    joinFormation: TroopComposition;
    hostFormation: TroopComposition;
    mode: FillMode;
}
