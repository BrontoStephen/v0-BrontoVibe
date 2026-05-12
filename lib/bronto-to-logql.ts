export function translateBrontoSQLToLogQL(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  if (/^\{/.test(trimmed) || /^\|[=~]/.test(trimmed)) return trimmed;

  const clauses = splitAnd(trimmed);
  const labelMatchers: string[] = [];
  const lineFilters: string[] = [];

  for (const clause of clauses) {
    const c = clause.trim();

    const rawIlike = c.match(/^@raw\s+ILIKE\s+'%(.+)%'$/i);
    if (rawIlike) {
      lineFilters.push(`|= "${escDQ(unescSql(rawIlike[1]))}"`);
      continue;
    }

    const rawNotIlike = c.match(/^@raw\s+NOT\s+ILIKE\s+'%(.+)%'$/i);
    if (rawNotIlike) {
      lineFilters.push(`!= "${escDQ(unescSql(rawNotIlike[1]))}"`);
      continue;
    }

    const rawRegexp = c.match(/^@raw\s+REGEXP\s+'(.+)'$/i);
    if (rawRegexp) {
      lineFilters.push(`|~ "${escDQ(unescSql(rawRegexp[1]))}"`);
      continue;
    }

    const rawNotRegexp = c.match(/^@raw\s+NOT\s+REGEXP\s+'(.+)'$/i);
    if (rawNotRegexp) {
      lineFilters.push(`!~ "${escDQ(unescSql(rawNotRegexp[1]))}"`);
      continue;
    }

    const eqMatch = c.match(/^"([^"]+)"(=|!=)'([^']*)'$/);
    if (eqMatch) {
      const [, key, op, val] = eqMatch;
      labelMatchers.push(`${unescIdent(key)}${op}"${escDQ(unescSql(val))}"`);
      continue;
    }

    const regMatch = c.match(/^"([^"]+)"(~|!~)'([^']*)'$/);
    if (regMatch) {
      const [, key, op, val] = regMatch;
      const logqlOp = op === '~' ? '=~' : '!~';
      labelMatchers.push(`${unescIdent(key)}${logqlOp}"${escDQ(unescSql(val))}"`);
      continue;
    }

    const spaceEq = c.match(/^"?([^"=!~<>]+)"?\s*(=|!=)\s*'([^']*)'$/);
    if (spaceEq) {
      const [, key, op, val] = spaceEq;
      labelMatchers.push(`${key.trim()}${op}"${escDQ(unescSql(val))}"`);
      continue;
    }

    lineFilters.push(`|= "${escDQ(c)}"`);
  }

  let result = '';
  if (labelMatchers.length > 0) {
    result = `{${labelMatchers.join(',')}}`;
  }
  if (lineFilters.length > 0) {
    result += (result ? ' ' : '') + lineFilters.join(' ');
  }
  return result;
}

function splitAnd(input: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }
    if (!inSingle && !inDouble) {
      if (/^\s+AND\s+/i.test(input.slice(i))) {
        parts.push(current);
        const andMatch = input.slice(i).match(/^\s+AND\s+/i)!;
        i += andMatch[0].length - 1;
        current = '';
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function escDQ(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function unescSql(s: string): string {
  return s.replace(/''/g, "'");
}

function unescIdent(s: string): string {
  return s.replace(/""/g, '"');
}
