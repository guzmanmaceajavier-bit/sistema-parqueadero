import es from "./es.json";
import en from "./en.json";

const translations = { es, en };
let currentLang = localStorage.getItem("lang") || "es";

export function t(key: string, lang?: string): string {
  const l = lang || currentLang;
  const keys = key.split(".");
  let obj: Record<string, unknown> = translations[l] || translations.es;
  for (const k of keys) {
    if (obj && typeof obj === "object" && k in obj) {
      obj = obj[k] as Record<string, unknown>;
    } else {
      return key;
    }
  }
  return typeof obj === "string" ? obj : key;
}

export function setLang(lang: string) {
  currentLang = lang;
  localStorage.setItem("lang", lang);
}

export function getLang() {
  return currentLang;
}
