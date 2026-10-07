import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { STORAGE_KEYS } from "../config/constants";
import { updateCompanyTheme, fetchCompanyDetails } from "../services/tenantService";

export const THEME_PRESETS = [
  {
    id: "lifesurf-blue",
    nome: "Azul Padrão LifeSurf",
    descricao: "Identidade esportiva oficial com azuis oceano e tons náuticos profundos.",
    mode: "dark",
    primaryColor: "#0284c7", // sky-600
    accentColor: "#38bdf8",  // sky-400
    bgMain: "#090d16",
    bgCard: "rgba(15, 23, 42, 0.8)",
    badgeText: "Oficial",
    badgeColor: "sky"
  },
  {
    id: "sunset-orange",
    nome: "Sunset Laranja & Surf",
    descricao: "Paleta quente, esportiva e vibrante inspirada nas cores do entardecer e moda praia.",
    mode: "dark",
    primaryColor: "#f97316", // orange-500
    accentColor: "#fb923c",  // orange-400
    bgMain: "#140d0a",
    bgCard: "rgba(30, 20, 16, 0.85)",
    badgeText: "Surfwear",
    badgeColor: "warning"
  },
  {
    id: "emerald-pro",
    nome: "Esmeralda ERP & Vendas",
    descricao: "Verde esmeralda sofisticado focado em finanças, vendas e alta rentabilidade.",
    mode: "dark",
    primaryColor: "#10b981", // emerald-500
    accentColor: "#34d399",  // emerald-400
    bgMain: "#04130e",
    bgCard: "rgba(6, 28, 20, 0.85)",
    badgeText: "Finanças",
    badgeColor: "success"
  },
  {
    id: "dark-stealth",
    nome: "Preto Absoluto (AMOLED)",
    descricao: "Preto puro e alto contraste para uso contínuo, focado em agilidade no PDV.",
    mode: "dark",
    primaryColor: "#6366f1", // indigo-500
    accentColor: "#a855f7",  // purple-500
    bgMain: "#000000",
    bgCard: "rgba(12, 14, 20, 0.95)",
    badgeText: "AMOLED",
    badgeColor: "purple"
  },
  {
    id: "light-clean",
    nome: "Branco Clean (Modo Claro)",
    descricao: "Interface corporativa clara, elegante e nítida para ambientes iluminados.",
    mode: "light",
    primaryColor: "#0284c7",
    accentColor: "#0369a1",
    bgMain: "#f8fafc",
    bgCard: "#ffffff",
    badgeText: "Clean Light",
    badgeColor: "neutral"
  },
  {
    id: "custom",
    nome: "Personalizado (Marca Própria)",
    descricao: "Defina as cores exatas da sua marca com seletores hexadecimais ao vivo.",
    mode: "dark",
    primaryColor: "#0284c7",
    accentColor: "#38bdf8",
    bgMain: "#090d16",
    bgCard: "rgba(15, 23, 42, 0.8)",
    badgeText: "Custom",
    badgeColor: "pink"
  }
];

function hexToRgb(hex) {
  if (!hex) return "2, 132, 199";
  let c = hex.replace("#", "");
  if (c.length === 3) {
    c = c.split("").map((x) => x + x).join("");
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return "2, 132, 199";
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r}, ${g}, ${b}`;
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children, activeTenantId = null }) {
  // Inicializa o tema a partir do localStorage ou padrão
  const [themeConfig, setThemeConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.THEME);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignora erro
    }
    return {
      id: "lifesurf-blue",
      primaryColor: "#0284c7",
      accentColor: "#38bdf8",
      mode: "dark"
    };
  });

  // Aplica as propriedades do tema no documento HTML
  const applyThemeToDOM = useCallback((config) => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    const body = document.body;

    const isLight = config.mode === "light" || config.id === "light-clean";

    // 1. Define atributos data-theme e data-mode
    root.setAttribute("data-theme", config.id || "lifesurf-blue");
    root.setAttribute("data-mode", isLight ? "light" : "dark");

    // 2. Define classes dark/light
    if (isLight) {
      root.classList.remove("dark");
      root.classList.add("light");
      body.classList.remove("dark");
      body.classList.add("light");
    } else {
      root.classList.remove("light");
      root.classList.add("dark");
      body.classList.remove("light");
      body.classList.add("dark");
    }

    // 3. Aplica variáveis CSS dinâmicas para primária, acento e fundos
    const preset = THEME_PRESETS.find((p) => p.id === config.id);
    const primary = config.primaryColor || preset?.primaryColor || "#0284c7";
    const accent = config.accentColor || preset?.accentColor || "#38bdf8";
    const rgbStr = hexToRgb(primary);
    const accentRgbStr = hexToRgb(accent);

    root.style.setProperty("--brand-primary", primary);
    root.style.setProperty("--brand-accent", accent);
    root.style.setProperty("--brand-primary-rgb", rgbStr);
    root.style.setProperty("--brand-accent-rgb", accentRgbStr);
    root.style.setProperty("--brand-primary-hover", accent);
    root.style.setProperty("--brand-glow", `rgba(${rgbStr}, 0.25)`);
    root.style.setProperty("--brand-subtle", `rgba(${rgbStr}, 0.12)`);
    root.style.setProperty("--brand-border", `rgba(${rgbStr}, 0.35)`);

    if (isLight) {
      root.style.setProperty("--bg-main", "#f8fafc");
      root.style.setProperty("--bg-card", "#ffffff");
      root.style.setProperty("--bg-card-hover", "#f1f5f9");
      root.style.setProperty("--border-subtle", "rgba(0, 0, 0, 0.08)");
    } else if (config.id === "dark-stealth") {
      root.style.setProperty("--bg-main", "#000000");
      root.style.setProperty("--bg-card", "#0c0e14");
      root.style.setProperty("--bg-card-hover", "#161922");
      root.style.setProperty("--border-subtle", "rgba(255, 255, 255, 0.1)");
    } else if (config.id === "emerald-pro") {
      root.style.setProperty("--bg-main", "#03120c");
      root.style.setProperty("--bg-card", "#062117");
      root.style.setProperty("--bg-card-hover", "#0c3224");
      root.style.setProperty("--border-subtle", "rgba(52, 211, 153, 0.15)");
    } else if (config.id === "sunset-orange") {
      root.style.setProperty("--bg-main", "#120c09");
      root.style.setProperty("--bg-card", "#22140e");
      root.style.setProperty("--bg-card-hover", "#331f16");
      root.style.setProperty("--border-subtle", "rgba(249, 115, 22, 0.15)");
    } else {
      root.style.setProperty("--bg-main", preset?.bgMain || "#090d16");
      root.style.setProperty("--bg-card", preset?.bgCard || "#0f172a");
      root.style.setProperty("--bg-card-hover", "rgba(30, 41, 59, 0.85)");
      root.style.setProperty("--border-subtle", "rgba(255, 255, 255, 0.08)");
    }
  }, []);

  // Efeito para sincronizar com DOM na montagem e mudança de config
  useEffect(() => {
    applyThemeToDOM(themeConfig);
  }, [themeConfig, applyThemeToDOM]);

  // Efeito para sincronizar tema a partir do Firestore ao carregar/trocar empresa
  useEffect(() => {
    if (!activeTenantId) return;

    let isMounted = true;
    async function sincronizarTemaEmpresa() {
      try {
        const details = await fetchCompanyDetails(activeTenantId);
        if (isMounted && details?.temaConfig) {
          const cfg = details.temaConfig;
          setThemeConfig((prev) => {
            if (
              prev.id === cfg.id &&
              prev.primaryColor === cfg.primaryColor &&
              prev.accentColor === cfg.accentColor &&
              prev.mode === cfg.mode
            ) {
              return prev;
            }
            return cfg;
          });
          applyThemeToDOM(cfg);
          try {
            localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(cfg));
          } catch {}
        }
      } catch (err) {
        console.warn("[ThemeContext] Erro ao carregar tema da empresa:", err);
      }
    }

    sincronizarTemaEmpresa();

    const handleThemeEvent = (e) => {
      if (e?.detail) {
        setThemeConfig(e.detail);
        applyThemeToDOM(e.detail);
      }
    };

    window.addEventListener("lifesurf:tenant_theme_changed", handleThemeEvent);
    return () => {
      isMounted = false;
      window.removeEventListener("lifesurf:tenant_theme_changed", handleThemeEvent);
    };
  }, [activeTenantId, applyThemeToDOM]);

  /**
   * Altera o tema ativo e persiste no LocalStorage e no Firestore
   */
  const changeTheme = useCallback(async (newConfig, persistToFirestore = true) => {
    let completeConfig = { ...newConfig };

    // Se passou apenas o ID do preset
    if (typeof newConfig === "string") {
      const found = THEME_PRESETS.find((p) => p.id === newConfig);
      if (found) {
        completeConfig = {
          id: found.id,
          primaryColor: found.primaryColor,
          accentColor: found.accentColor,
          mode: found.mode
        };
      }
    }

    setThemeConfig(completeConfig);
    applyThemeToDOM(completeConfig);

    // Salva no LocalStorage
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(completeConfig));
    } catch {
      // Ignora erro
    }

    // Notifica outros listeners na mesma janela
    try {
      window.dispatchEvent(new CustomEvent("lifesurf:tenant_theme_changed", { detail: completeConfig }));
    } catch {}

    // Salva no Firestore se houver empresa ativa
    if (persistToFirestore && activeTenantId) {
      await updateCompanyTheme(activeTenantId, completeConfig);
    }
  }, [activeTenantId, applyThemeToDOM]);

  /**
   * Atualiza as cores personalizadas do tema
   */
  const setCustomColors = useCallback((primaryColor, accentColor, mode = "dark") => {
    const newConfig = {
      id: "custom",
      primaryColor,
      accentColor,
      mode
    };
    changeTheme(newConfig, true);
  }, [changeTheme]);

  const activePreset = useMemo(() => {
    return THEME_PRESETS.find((p) => p.id === themeConfig.id) || THEME_PRESETS[0];
  }, [themeConfig.id]);

  const value = useMemo(() => ({
    themeConfig,
    activePreset,
    currentThemeId: themeConfig.id || "lifesurf-blue",
    isLightMode: themeConfig.mode === "light" || themeConfig.id === "light-clean",
    presets: THEME_PRESETS,
    changeTheme,
    setCustomColors
  }), [themeConfig, activePreset, changeTheme, setCustomColors]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme deve ser utilizado dentro de um <ThemeProvider />");
  }
  return context;
}
