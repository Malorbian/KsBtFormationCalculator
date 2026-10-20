export function readInt(id: string, fallback = 0): number {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) return fallback;
    const v = Number.parseInt(el.value, 10);
    return Number.isFinite(v) ? v : fallback;
}

export function readNumber(id: string, fallback = 0): number {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) return fallback;
    const v = Number.parseFloat(el.value);
    return Number.isFinite(v) ? v : fallback;
}

export function readOptionalNumber(id: string): number | null {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el || el.value.trim() === "") return null;
    const v = Number.parseFloat(el.value);
    return Number.isFinite(v) ? v : null;
}

export function readBool(id: string): boolean {
    const el = document.getElementById(id) as HTMLInputElement | null;
    return !!(el && el.checked);
}

export function readSelectValue(id: string): string {
    const el = document.getElementById(id) as HTMLSelectElement | null;
    return el?.value ?? "";
}

export function setOutput(id: string, value: number | string): void {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) return;
    el.value = String(value);
}
