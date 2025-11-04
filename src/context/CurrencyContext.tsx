import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type CurrencyOption = {
  code: string;
  symbol: string;
  label: string;
};

export const SUPPORTED_CURRENCIES = [
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "CAD", symbol: "CA$", label: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar" },
  { code: "INR", symbol: "₹", label: "Indian Rupee" },
  { code: "JPY", symbol: "¥", label: "Japanese Yen" },
  { code: "SGD", symbol: "S$", label: "Singapore Dollar" },
] as const satisfies ReadonlyArray<CurrencyOption>;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]["code"];

type ExchangeRateMap = Record<SupportedCurrency, number>;

type ConvertOptions = {
  from?: string;
};

type FormatOptions = ConvertOptions & {
  maximumFractionDigits?: number;
};

type CurrencyContextValue = {
  currency: SupportedCurrency;
  setCurrency: (currency: SupportedCurrency) => void;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  rates: ExchangeRateMap;
  convert: (amount: number | null | undefined, options?: ConvertOptions) => number | null;
  format: (amount: number | null | undefined, options?: FormatOptions) => string;
};

const BASE_CURRENCY: SupportedCurrency = "USD";
const DEFAULT_RATES: ExchangeRateMap = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  AUD: 1.56,
  INR: 83.12,
  JPY: 151.2,
  SGD: 1.34,
};

const STORAGE_KEY = "cloudctrl.currency.selected";
const RATES_KEY = "cloudctrl.currency.rates";
const UPDATED_KEY = "cloudctrl.currency.updated";

const supportedCodeSet = new Set<SupportedCurrency>(SUPPORTED_CURRENCIES.map((option) => option.code));

const parseStoredCurrency = (): SupportedCurrency => {
  if (typeof window === "undefined") {
    return BASE_CURRENCY;
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && supportedCodeSet.has(stored as SupportedCurrency)) {
    return stored as SupportedCurrency;
  }
  return BASE_CURRENCY;
};

const parseStoredRates = () => {
  if (typeof window === "undefined") {
    return { rates: DEFAULT_RATES, updated: null };
  }
  try {
    const raw = window.localStorage.getItem(RATES_KEY);
    const next: ExchangeRateMap = { ...DEFAULT_RATES };
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, number>;
      for (const [code, value] of Object.entries(parsed)) {
        const normalized = code.toUpperCase();
        if (supportedCodeSet.has(normalized as SupportedCurrency) && Number.isFinite(value)) {
          next[normalized as SupportedCurrency] = value;
        }
      }
    }
    const updatedRaw = window.localStorage.getItem(UPDATED_KEY);
    const updated = updatedRaw ? new Date(updatedRaw) : null;
    return { rates: next, updated: Number.isNaN(updated?.getTime() ?? NaN) ? null : updated };
  } catch (error) {
    console.warn("Failed to read stored currency rates", error);
    return { rates: DEFAULT_RATES, updated: null };
  }
};

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

const normalizeCurrencyCode = (code?: string): SupportedCurrency | null => {
  if (!code) return null;
  const upper = code.toUpperCase();
  return supportedCodeSet.has(upper as SupportedCurrency) ? (upper as SupportedCurrency) : null;
};

const REFRESH_ENDPOINT = "https://open.er-api.com/v6/latest/USD";

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [currency, setCurrencyState] = useState<SupportedCurrency>(() => parseStoredCurrency());
  const stored = useMemo(() => parseStoredRates(), []);
  const [rates, setRates] = useState<ExchangeRateMap>(stored.rates);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(stored.updated);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const setCurrency = useCallback(
    (nextCurrency: SupportedCurrency) => {
      setCurrencyState((prev) => {
        if (prev === nextCurrency) {
          return prev;
        }
        return nextCurrency;
      });
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, nextCurrency);
      }
    },
    [],
  );

  const convert = useCallback(
    (amount: number | null | undefined, options?: ConvertOptions) => {
      if (typeof amount !== "number" || !Number.isFinite(amount)) {
        return null;
      }
      const fromCode = normalizeCurrencyCode(options?.from) ?? BASE_CURRENCY;
      const fromRate = rates[fromCode] ?? DEFAULT_RATES[fromCode] ?? 1;
      const toRate = rates[currency] ?? DEFAULT_RATES[currency] ?? 1;
      if (!fromRate || !toRate) {
        return null;
      }
      const usdAmount = amount / fromRate;
      const converted = usdAmount * toRate;
      return Number.isFinite(converted) ? converted : null;
    },
    [currency, rates],
  );

  const format = useCallback(
    (amount: number | null | undefined, options?: FormatOptions) => {
      const converted = convert(amount, options);
      if (converted == null) {
        return "—";
      }
      const maximumFractionDigits = options?.maximumFractionDigits ?? (currency === "JPY" ? 0 : 2);
      try {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
          maximumFractionDigits,
        }).format(converted);
      } catch (formatError) {
        console.warn("Falling back to simple formatting for currency", formatError);
        return `${converted.toFixed(Math.min(maximumFractionDigits, 4))} ${currency}`;
      }
    },
    [convert, currency],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    let isMounted = true;
    const controller = new AbortController();

    const refreshRates = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(REFRESH_ENDPOINT, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Currency request failed with status ${response.status}`);
        }
        const payload: { result?: string; rates?: Record<string, number> } = await response.json();
        if (payload.result !== "success" || !payload.rates) {
          throw new Error("Unexpected currency response payload");
        }
        const nextRates: ExchangeRateMap = { ...DEFAULT_RATES };
        for (const option of SUPPORTED_CURRENCIES) {
          const value = payload.rates[option.code];
          if (typeof value === "number" && Number.isFinite(value)) {
            nextRates[option.code] = value;
          }
        }
        if (!isMounted) {
          return;
        }
        setRates(nextRates);
        const updatedAt = new Date();
        setLastUpdated(updatedAt);
        setError(null);
        window.localStorage.setItem(RATES_KEY, JSON.stringify(nextRates));
        window.localStorage.setItem(UPDATED_KEY, updatedAt.toISOString());
      } catch (refreshError) {
        if (!isMounted || (refreshError instanceof DOMException && refreshError.name === "AbortError")) {
          return;
        }
        console.error("Failed to refresh currency rates", refreshError);
        setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh currency rates");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    refreshRates();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      setCurrency,
      isLoading,
      error,
      lastUpdated,
      rates,
      convert,
      format,
    }),
    [convert, currency, error, format, isLoading, lastUpdated, rates, setCurrency],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
};
