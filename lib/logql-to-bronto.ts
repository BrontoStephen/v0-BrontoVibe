export type TranslateResult = { ok: true; sql: string } | { ok: false; error: string; at?: number };

type LabelOp = '=' | '!=' | '=~' | '!~';
type LineOp = '|=' | '!=' | '|~' | '!~';
type LabelMatcher = { key: string; op: LabelOp; value: string };
type LineFilter = { op: LineOp; value: string };

const WS = /\s*/y;

function err(error: string, at?: number): { ok: false; error: string; at?: number } {
  return { ok: false, error, at };
}

export function translateLogQLToBrontoSQL(input: string): TranslateResult {
  const src = input.trim();
  if (!src) return err('empty query');

  let i = 0;
  const clauses: string[] = [];

  if (src[i] === '{') {
    const sel = readSelector(src, i);
    if ('error' in sel) return { ok: false, ...sel };
    i = sel.next;
    for (const m of sel.matchers) clauses.push(emitLabelMatcher(m));
  }

  while (true) {
    i = skipWS(src, i);
    if (i >= src.length) break;

    const lf = readLineFilter(src, i);
    if ('error' in lf) {
      if (clauses.length === 0) {
        const text = src.slice(i).trim();
        if (!text) break;
        clauses.push(emitRawContains(unquoteIfQuoted(text)));
        break;
      }
      return { ok: false, ...lf };
    }
    i = lf.next;
    clauses.push(emitLineFilter(lf.filter));
  }

  if (clauses.length === 0) return err('no supported logql parts found');
  return { ok: true, sql: clauses.join(' AND ') };
}

type Fail = { error: string; at?: number };

function readSelector(src: string, start: number): { matchers: LabelMatcher[]; next: number } | Fail {
  let i = start;
  if (src[i] !== '{') return { error: "expected '{'", at: i };
  i++;
  const matchers: LabelMatcher[] = [];
  i = skipWS(src, i);
  if (src[i] === '}') return { matchers, next: i + 1 };

  while (i < src.length) {
    i = skipWS(src, i);
    const key = readToken(src, i);
    if ('error' in key) return key;
    i = key.next;
    i = skipWS(src, i);
    const op = readOp<LabelOp>(src, i, ['=~', '!~', '!=', '=']);
    if ('error' in op) return op;
    i = op.next;
    i = skipWS(src, i);
    const val = readDQString(src, i);
    if ('error' in val) return val;
    i = val.next;
    matchers.push({ key: key.value, op: op.value, value: val.value });
    i = skipWS(src, i);
    if (src[i] === ',') {
      i++;
      continue;
    }
    if (src[i] === '}') {
      i++;
      return { matchers, next: i };
    }
    return { error: "expected ',' or '}'", at: i };
  }
  return { error: 'unterminated selector', at: start };
}

function readLineFilter(src: string, start: number): { filter: LineFilter; next: number } | Fail {
  let i = start;
  const op = readOp<LineOp>(src, i, ['|=', '|~', '!=', '!~']);
  if ('error' in op) return { error: 'expected line filter operator', at: i };
  i = op.next;
  i = skipWS(src, i);
  const val = readDQString(src, i);
  if ('error' in val) return val;
  return { filter: { op: op.value, value: val.value }, next: val.next };
}

function readToken(src: string, start: number): { value: string; next: number } | Fail {
  if (start >= src.length) return { error: 'expected identifier', at: start };
  const re = /[A-Za-z_][A-Za-z0-9_.:\/-]*/y;
  re.lastIndex = start;
  const m = re.exec(src);
  if (!m) return { error: 'expected identifier', at: start };
  return { value: m[0], next: re.lastIndex };
}

function readDQString(src: string, start: number): { value: string; next: number } | Fail {
  let i = start;
  if (src[i] !== '"') return { error: 'expected "value"', at: i };
  i++;
  let out = '';
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"') return { value: out, next: i + 1 };
    if (ch === '\\') {
      i++;
      if (i >= src.length) return { error: 'unterminated escape', at: i };
      const e = src[i];
      if (e === '"' || e === '\\' || e === '/') out += e;
      else if (e === 'n') out += '\n';
      else if (e === 't') out += '\t';
      else out += e;
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return { error: 'unterminated string', at: start };
}

function readOp<T extends string>(src: string, start: number, options: readonly T[]): { value: T; next: number } | Fail {
  for (const opt of options) {
    if (src.startsWith(opt, start)) return { value: opt, next: start + opt.length };
  }
  return { error: `expected one of: ${options.join(', ')}`, at: start };
}

function skipWS(src: string, i: number): number {
  WS.lastIndex = i;
  WS.exec(src);
  return WS.lastIndex;
}

function emitLabelMatcher(m: LabelMatcher): string {
  const key = quoteIdent(m.key);
  const val = quoteSql(m.value);
  switch (m.op) {
    case '=':
      return `${key}=${val}`;
    case '!=':
      return `${key}!=${val}`;
    case '=~':
      return `${key}~${val}`;
    case '!~':
      return `${key}!~${val}`;
  }
}

function emitLineFilter(f: LineFilter): string {
  switch (f.op) {
    case '|=':
      return emitRawContains(f.value);
    case '!=':
      return `@raw NOT ILIKE ${quoteSql(`%${f.value}%`)}`;
    case '|~':
      return `@raw REGEXP ${quoteSql(f.value)}`;
    case '!~':
      return `@raw NOT REGEXP ${quoteSql(f.value)}`;
  }
}

function emitRawContains(text: string): string {
  return `@raw ILIKE ${quoteSql(`%${text}%`)}`;
}

function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

function quoteSql(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function unquoteIfQuoted(s: string): string {
  const t = s.trim();
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2)
    return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  return t;
}
