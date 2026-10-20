import { BaseStatLoader } from "./calculator/LoadBaseStats.js";
import { initializeI18n } from "./language/index.js";
import { calculateAndFillOutputs, resetTargetRatioToDefault, setArmyStats, updateRatioFromStats } from "./ui/calculateAndFillOutputs.js";
import { initializeInfoModal } from "./ui/infoModal.js";
import { initializeTierCollapsibles } from "./ui/tierCollapsible.js";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("calculator-form") as HTMLFormElement | null;
    if (!form) return;

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        calculateAndFillOutputs();
    });

    form.addEventListener("input", (event) => {
        const target = event.target as HTMLInputElement | null;

        // Editing one of the ratio fields means the user is switching back
        // to manual ratio mode. The current values are kept as entered.
        if (target?.id.startsWith("target-ratio-")) {
            const useStats = document.getElementById("use-stats-ratio") as HTMLInputElement | null;
            if (useStats) {
                useStats.checked = false;
            }
        }

        calculateAndFillOutputs();
    });
    form.addEventListener("change", calculateAndFillOutputs);

    const useStatsCheckbox =
        document.getElementById(
            "use-stats-ratio"
        ) as HTMLInputElement | null;

    useStatsCheckbox?.addEventListener(
        "change",
        () => {

            if (useStatsCheckbox.checked) {
                updateRatioFromStats();
            }

            calculateAndFillOutputs();
        }
    );

    const resetRatioButton = document.getElementById("reset-target-ratio") as HTMLButtonElement | null;
    resetRatioButton?.addEventListener("click", () => {
        resetTargetRatioToDefault();
        calculateAndFillOutputs();
    });

    initializeTierCollapsibles();
    initializeInfoModal();

    void initializeI18n(calculateAndFillOutputs).then(async () => {
        const loader = await BaseStatLoader.load();
        setArmyStats(loader?.getTroopBaseStats() ?? null);
        calculateAndFillOutputs();
    });


});
