const DEFAULT_LANGUAGE = "en";
const LANGUAGE_STORAGE_KEY = "ksbt-language";
const fallbackLanguages = [
    { code: "en", name: "English", nativeName: "English", dir: "ltr" }
];
const defaultTranslations = {
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
    "options.maxMarches": "Max Marches",
    "options.hostOwnRally": "Host own rally",
    "formations.join": "Join Formation",
    "formations.host": "Host Formation",
    "status.formationsCalculated": "Formations calculated.",
    "errors.marchCountGreaterThanZero": "March count must be greater than 0.",
    "errors.calculation": "Calculation error",
    "aria.infoImages": "Info: mobile images",
    "aria.infoVideo": "Info: short video",
    "aria.closeInfo": "Close info window",
    "aria.previousImage": "Previous image",
    "aria.nextImage": "Next image",
    "modal.videoNotSupported": "Your browser does not support the video tag."
};
let currentTranslations = { ...defaultTranslations };
let currentLanguage = DEFAULT_LANGUAGE;
let currentDirection = "ltr";
export function t(key, fallback) {
    return currentTranslations[key]
        ?? defaultTranslations[key]
        ?? fallback
        ?? key;
}
async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) {
        throw new Error(`Could not load ${url}`);
    }
    return await response.json();
}
function normalizeLanguageMeta(meta) {
    return {
        code: meta.code,
        name: meta.name,
        nativeName: meta.nativeName || meta.name || meta.code,
        dir: meta.dir === "rtl" ? "rtl" : "ltr"
    };
}
async function loadAvailableLanguages() {
    try {
        const languages = await fetchJson("i18n/languages.json");
        return languages
            .filter((language) => language.code && (language.nativeName || language.name))
            .map(normalizeLanguageMeta);
    }
    catch {
        return fallbackLanguages;
    }
}
async function loadTranslations(languageCode) {
    if (languageCode === DEFAULT_LANGUAGE) {
        return { ...defaultTranslations };
    }
    try {
        const loadedTranslations = await fetchJson(`i18n/${languageCode}.json`);
        return { ...defaultTranslations, ...loadedTranslations };
    }
    catch {
        return { ...defaultTranslations };
    }
}
function getPreferredLanguage(availableLanguages) {
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
function translatePage() {
    document.documentElement.lang = currentLanguage;
    document.documentElement.dir = currentDirection;
    document.title = t("app.title", "KsBt Formation Calculator");
    document.querySelectorAll("[data-i18n]").forEach((element) => {
        const key = element.dataset.i18n;
        if (!key)
            return;
        element.textContent = t(key, element.textContent ?? undefined);
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
        const key = element.getAttribute("data-i18n-aria-label");
        if (!key)
            return;
        element.setAttribute("aria-label", t(key, element.getAttribute("aria-label") ?? undefined));
    });
}
function populateLanguageSelect(select, availableLanguages) {
    select.replaceChildren();
    for (const language of availableLanguages) {
        const option = document.createElement("option");
        option.value = language.code;
        option.textContent = language.nativeName;
        select.appendChild(option);
    }
}
async function setLanguage(languageCode, availableLanguages) {
    const selectedLanguage = availableLanguages.find((language) => language.code === languageCode)
        ?? availableLanguages.find((language) => language.code === DEFAULT_LANGUAGE)
        ?? fallbackLanguages[0];
    currentLanguage = selectedLanguage.code;
    currentDirection = selectedLanguage.dir ?? "ltr";
    currentTranslations = await loadTranslations(selectedLanguage.code);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, selectedLanguage.code);
    translatePage();
}
export async function initializeI18n(onLanguageChanged) {
    const availableLanguages = await loadAvailableLanguages();
    const select = document.getElementById("language-select");
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
