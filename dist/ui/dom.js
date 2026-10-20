export function readInt(id, fallback = 0) {
    const el = document.getElementById(id);
    if (!el)
        return fallback;
    const v = Number.parseInt(el.value, 10);
    return Number.isFinite(v) ? v : fallback;
}
export function readNumber(id, fallback = 0) {
    const el = document.getElementById(id);
    if (!el)
        return fallback;
    const v = Number.parseFloat(el.value);
    return Number.isFinite(v) ? v : fallback;
}
export function readOptionalNumber(id) {
    const el = document.getElementById(id);
    if (!el || el.value.trim() === "")
        return null;
    const v = Number.parseFloat(el.value);
    return Number.isFinite(v) ? v : null;
}
export function readBool(id) {
    const el = document.getElementById(id);
    return !!(el && el.checked);
}
export function readSelectValue(id) {
    const el = document.getElementById(id);
    return el?.value ?? "";
}
export function setOutput(id, value) {
    const el = document.getElementById(id);
    if (!el)
        return;
    el.value = String(value);
}
