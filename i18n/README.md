# Translations

The calculator reads translations from JSON files in this folder.

## Add a new language

1. Add the language to `languages.json`:

```json
{ "code": "ja", "name": "Japanese", "nativeName": "日本語", "dir": "ltr" }
```

Use `"dir": "rtl"` for right-to-left languages like Arabic or Hebrew.

2. Copy `en.json` to `<code>.json`, for example `ja.json`.
3. Translate only the values. Do not change the keys.
4. Keep all files saved as UTF-8 so non-Latin letters display correctly.

Example:

```json
{
  "troops.infantry": "歩兵"
}
```

The app merges missing keys with English, so incomplete translation files still work.

## Added language files

The following extra translation files are included:

- `es.json` — Spanish / Español
- `zh.json` — Mandarin Chinese / 中文（普通话）
- `hi.json` — Hindi / हिन्दी
- `tr.json` — Turkish / Türkçe
- `ko.json` — Korean / 한국어
- `fr.json` — French / Français
- `th.json` — Thai / ไทย
- `id.json` — Indonesian / Bahasa Indonesia

Indonesian is the language name in English; in the language itself it is called Bahasa Indonesia.

