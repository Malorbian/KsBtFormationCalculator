import { readInt } from "./dom.js";
import { RatioCalculation } from "../calculator/RatioCalculation.js";
function setRatioFields(infantry, cavalry, archers) {
    const infInput = document.getElementById("target-ratio-infantry");
    const cavInput = document.getElementById("target-ratio-cavalry");
    const arcInput = document.getElementById("target-ratio-archer");
    if (infInput)
        infInput.value = String(infantry);
    if (cavInput)
        cavInput.value = String(cavalry);
    if (arcInput)
        arcInput.value = String(archers);
}
function computeRatioFromStats() {
    return RatioCalculation.calculateFromStats({
        infantryAttack: readInt("stats-infantry-attack", 0),
        infantryLethality: readInt("stats-infantry-lethality", 0),
        cavalryAttack: readInt("stats-cavalry-attack", 0),
        cavalryLethality: readInt("stats-cavalry-lethality", 0),
        archersAttack: readInt("stats-archer-attack", 0),
        archersLethality: readInt("stats-archer-lethality", 0)
    });
}
export function initializeRatioControls(onRatioChanged) {
    const autoCheckbox = document.getElementById("ratio-based-on-stats");
    const statsPanel = document.getElementById("stats-fields");
    const ratioInputs = [
        document.getElementById("target-ratio-infantry"),
        document.getElementById("target-ratio-cavalry"),
        document.getElementById("target-ratio-archer")
    ];
    if (!autoCheckbox || !statsPanel) {
        return;
    }
    const applyAutoRatio = () => {
        const ratio = computeRatioFromStats();
        setRatioFields(ratio.infantry, ratio.cavalry, ratio.archers);
        onRatioChanged();
    };
    const setAutoMode = (enabled) => {
        statsPanel.classList.toggle("hidden", !enabled);
        for (const input of ratioInputs) {
            if (input) {
                input.readOnly = enabled;
            }
        }
        if (enabled) {
            applyAutoRatio();
        }
        else {
            setRatioFields(RatioCalculation.DEFAULT_RATIO.infantry, RatioCalculation.DEFAULT_RATIO.cavalry, RatioCalculation.DEFAULT_RATIO.archers);
            onRatioChanged();
        }
    };
    autoCheckbox.addEventListener("change", () => {
        setAutoMode(autoCheckbox.checked);
    });
    [
        "stats-infantry-attack",
        "stats-infantry-lethality",
        "stats-cavalry-attack",
        "stats-cavalry-lethality",
        "stats-archer-attack",
        "stats-archer-lethality"
    ].forEach((id) => {
        const input = document.getElementById(id);
        if (!input)
            return;
        input.addEventListener("input", () => {
            if (autoCheckbox.checked) {
                applyAutoRatio();
            }
        });
    });
    setAutoMode(autoCheckbox.checked);
}
