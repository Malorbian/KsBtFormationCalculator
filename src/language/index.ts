type TextDirection = "ltr" | "rtl";

interface LanguageMeta {
    code: string;
    name: string;
    nativeName: string;
    dir?: TextDirection;
}

const DEFAULT_LANGUAGE = "en";
const LANGUAGE_STORAGE_KEY = "ksbt-language";

const fallbackLanguages: LanguageMeta[] = [
    { code: "en", name: "English", nativeName: "English", dir: "ltr" }
];

const defaultTranslations: Record<string, string> = {
    "app.title": "KsBt Formation Calculator",
    "app.heading": "Formation Calculator",
    "language.label": "Language",
    "sections.enterTroops": "Enter All Your Troops",
    "sections.formations": "Formations",
    "sections.options": "Options",
    "troops.infantry": "Infantry",
    "troops.cavalry": "Cavalry",
    "troops.archer": "Archer",
    "options.marchCap": "March cap",
    "options.joinCap": "Join cap",
    "options.maxMarches": "Join marches",
    "options.hostOwnRally": "Host own rally",
    "options.targetRatio": "Target ratio (%)",
    "options.resetRatio": "Reset to 1:20:79",
    "options.ratioHint": "You can edit the ratio manually. The three values are normalized automatically; manual edits turn stat-based calculation off. Use https://frakinator.streamlit.app to calculate the ratio for now.",
    "options.tgLevels": "Global TG levels",
    "options.stats": "Bonus stats (%)",
    "options.statsHint": "Enter all Attack and Lethality bonuses, then enable the checkbox below to calculate the ratio from your stats.",
    "options.useStatsRatio": "Use my stats to calculate the ratio",
    "options.attack": "Attack",
    "options.lethality": "Lethality",
    "formations.join": "Join Formation",
    "formations.host": "Host Formation",
    "status.formationsCalculated": "Formations calculated.",
    "status.formationsCalculatedRatio": "Formations calculated using the target ratio.",
    "status.formationsCalculatedDamage": "Formations calculated using tier damage priority and the 10% minimum per class.",
    "errors.marchCountGreaterThanZero": "At least one march is required.",
    "errors.invalidMarchCapacity": "March capacities must be greater than 0.",
    "errors.invalidTargetRatio": "The target ratio is invalid.",
    "errors.notEnoughTroops": "Not enough troops to fill all selected marches.",
    "errors.notEnoughClass": "Not enough troops of class:",
    "errors.notEnoughForMinimum": "Not enough troops to guarantee the 10% minimum for:",
    "errors.statsNotLoaded": "Troop base stats could not be loaded.",
    "errors.calculation": "Calculation error",
    "aria.infoImages": "Info: mobile images",
    "aria.infoVideo": "Info: short video",
    "aria.closeInfo": "Close info window",
    "aria.previousImage": "Previous image",
    "aria.nextImage": "Next image",
    "modal.videoNotSupported": "Your browser does not support the video tag."
};

let currentTranslations: Record<string, string> = { ...defaultTranslations };
let currentLanguage = DEFAULT_LANGUAGE;
let currentDirection: TextDirection = "ltr";

export function t(key: string, fallback?: string): string {
    return currentTranslations[key]
        ?? defaultTranslations[key]
        ?? fallback
        ?? key;
}

async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) {
        throw new Error(`Could not load ${url}`);
    }
    return await response.json() as T;
}

function normalizeLanguageMeta(meta: LanguageMeta): LanguageMeta {
    return {
        code: meta.code,
        name: meta.name,
        nativeName: meta.nativeName || meta.name || meta.code,
        dir: meta.dir === "rtl" ? "rtl" : "ltr"
    };
}

async function loadAvailableLanguages(): Promise<LanguageMeta[]> {
    try {
        const languages = await fetchJson<LanguageMeta[]>("i18n/languages.json");
        return languages
            .filter((language) => language.code && (language.nativeName || language.name))
            .map(normalizeLanguageMeta);
    } catch {
        return fallbackLanguages;
    }
}

async function loadTranslations(languageCode: string): Promise<Record<string, string>> {
    if (languageCode === DEFAULT_LANGUAGE) {
        return { ...defaultTranslations };
    }

    try {
        const loadedTranslations = await fetchJson<Record<string, string>>(`i18n/${languageCode}.json`);
        return { ...defaultTranslations, ...loadedTranslations };
    } catch {
        return { ...defaultTranslations };
    }
}

function getPreferredLanguage(availableLanguages: LanguageMeta[]): string {
    const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLanguage && availableLanguages.some((language) => language.code === savedLanguage)) {
        return savedLanguage;
    }

    const browserLanguage = navigator.language.split("-")[0];
    if (availableLanguages.some((language) => language.code === browserLanguage)) {
        return browserLanguage;
    }

    return DEFAULT_LANGUAGE;
}

function translatePage(): void {
    document.documentElement.lang = currentLanguage;
    document.documentElement.dir = currentDirection;
    document.title = t("app.title", "KsBt Formation Calculator");

    document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
        const key = element.dataset.i18n;
        if (!key) return;
        element.textContent = t(key, element.textContent ?? undefined);
    });

    document.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach((element) => {
        const key = element.getAttribute("data-i18n-aria-label");
        if (!key) return;
        element.setAttribute("aria-label", t(key, element.getAttribute("aria-label") ?? undefined));
    });
}

function populateLanguageSelect(select: HTMLSelectElement, availableLanguages: LanguageMeta[]): void {
    select.replaceChildren();

    for (const language of availableLanguages) {
        const option = document.createElement("option");
        option.value = language.code;
        option.textContent = language.nativeName;
        select.appendChild(option);
    }
}

async function setLanguage(languageCode: string, availableLanguages: LanguageMeta[]): Promise<void> {
    const selectedLanguage = availableLanguages.find((language) => language.code === languageCode)
        ?? availableLanguages.find((language) => language.code === DEFAULT_LANGUAGE)
        ?? fallbackLanguages[0];

    currentLanguage = selectedLanguage.code;
    currentDirection = selectedLanguage.dir ?? "ltr";
    currentTranslations = await loadTranslations(selectedLanguage.code);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, selectedLanguage.code);
    translatePage();
}

export async function initializeI18n(onLanguageChanged: () => void): Promise<void> {
    const availableLanguages = await loadAvailableLanguages();
    const select = document.getElementById("language-select") as HTMLSelectElement | null;
    const selectedLanguage = getPreferredLanguage(availableLanguages);

    if (select) {
        populateLanguageSelect(select, availableLanguages);
        select.value = selectedLanguage;
        select.addEventListener("change", () => {
            void setLanguage(select.value, availableLanguages).then(onLanguageChanged);
        });
    }

    await setLanguage(selectedLanguage, availableLanguages);
}
