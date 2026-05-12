import type { ViewMode } from './view-modes';
import { translateLogQLToBrontoSQL } from './logql-to-bronto';
import { translateBrontoSQLToLogQL } from './bronto-to-logql';

export function translateQuery(input: string, mode: ViewMode): string {
  if (!input.trim()) return '';
  if (mode === 'bronto') return input;

  if (/^\s*(SELECT|WHERE|FROM|INSERT|UPDATE|DELETE)\b/i.test(input)) return input;

  const result = translateLogQLToBrontoSQL(input);
  if (result.ok) return result.sql;

  return input;
}

export function translateBetweenModes(input: string, from: ViewMode, to: ViewMode): string {
  if (!input.trim() || from === to) return input;

  if (from === 'grafana' && to === 'bronto') {
    const result = translateLogQLToBrontoSQL(input);
    return result.ok ? result.sql : input;
  }

  if (from === 'bronto' && to === 'grafana') {
    return translateBrontoSQLToLogQL(input);
  }

  return input;
}
