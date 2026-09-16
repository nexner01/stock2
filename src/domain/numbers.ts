import Decimal from "decimal.js";

import type { Currency } from "./instruments";

export type DecimalKind = "price" | "exchangeRate" | "quantity" | "ratio";

export type DecimalAmount<K extends DecimalKind = DecimalKind> = Readonly<{
  kind: K;
  value: Decimal;
}>;

export type Money = Readonly<{
  kind: "money";
  value: Decimal;
  currency: Currency;
}>;

const requireFinite = (value: Decimal.Value, label: string): Decimal => {
  const decimal = new Decimal(value);
  if (!decimal.isFinite()) throw new Error(`${label} must be finite.`);
  return decimal;
};

export const createAmount = <K extends DecimalKind>(
  kind: K,
  value: Decimal.Value,
): DecimalAmount<K> => Object.freeze({ kind, value: requireFinite(value, kind) });

export const createMoney = (value: Decimal.Value, currency: Currency): Money =>
  Object.freeze({ kind: "money", value: requireFinite(value, "money"), currency });

export const decimalToString = (value: Decimal): string => value.toString();
