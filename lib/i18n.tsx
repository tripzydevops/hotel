"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { en } from "@/dictionaries/en";
import { tr } from "@/dictionaries/tr";

type Locale = "en" | "tr";
type Dictionary = typeof en;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (
    key: keyof Dictionary | string,
    params?: Record<string, string | number>,
  ) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");
  const [dictionary, setDictionary] = useState<Dictionary>(en);

  useEffect(() => {
    // Load saved locale from localStorage if available
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("tripzy_locale") as Locale;
      if (saved && (saved === "en" || saved === "tr")) {
        setLocale(saved);
      }
    }
  }, []);

  useEffect(() => {
    if (locale === "tr") setDictionary(tr);
    else setDictionary(en);

    if (typeof window !== "undefined") {
      localStorage.setItem("tripzy_locale", locale);
    }
  }, [locale]);

  const t = (key: string, params?: Record<string, string | number>) => {
    // Simple nested key support (e.g., "auth.login")
    const keys = key.split(".");
    let value: any = dictionary;

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k as keyof typeof value];
      } else {
        return key; // Fallback to key if not found
      }
    }

    if (typeof value === "string" && params) {
      return Object.entries(params).reduce((acc, [k, v]) => {
        return acc.replace(new RegExp(`{${k}}`, "g"), String(v));
      }, value);
    }

    return typeof value === "string" ? value : key;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
