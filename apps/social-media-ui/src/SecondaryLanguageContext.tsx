import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { ensureLocaleLoaded } from "./i18n";

type SecondaryLang = "hi" | "te" | "none";

type ContextValue = {
  secondaryLang: SecondaryLang;
  setSecondaryLang: (lang: SecondaryLang) => void;
};

const Ctx = createContext<ContextValue>({ secondaryLang: "none", setSecondaryLang: () => {} });

export function SecondaryLanguageProvider({ children }: { children: ReactNode }) {
  const [secondaryLang, setLang] = useState<SecondaryLang>(
    () => (localStorage.getItem("sm_secondary_lang") as SecondaryLang) || "none",
  );

  const setSecondaryLang = useCallback((lang: SecondaryLang) => {
    setLang(lang);
    localStorage.setItem("sm_secondary_lang", lang);
    if (lang !== "none") ensureLocaleLoaded(lang);
  }, []);

  // Pre-load the saved secondary language bundle on mount
  useEffect(() => {
    if (secondaryLang !== "none") ensureLocaleLoaded(secondaryLang);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <Ctx.Provider value={{ secondaryLang, setSecondaryLang }}>{children}</Ctx.Provider>;
}

export function useSecondaryLanguage(): SecondaryLang {
  return useContext(Ctx).secondaryLang;
}

export function useSetSecondaryLanguage(): (lang: SecondaryLang) => void {
  return useContext(Ctx).setSecondaryLang;
}
