export const formatValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const allPrimitive = value.every((item) => ["string", "number", "boolean"].includes(typeof item));
    if (allPrimitive) {
      return value.map((item) => String(item)).join(", ");
    }
    return JSON.stringify(value);
  }
  return JSON.stringify(value);
};

export const flattenRecord = (input: Record<string, unknown>, prefix = ""): { key: string; value: string }[] => {
  const rows: { key: string; value: string }[] = [];
  for (const [key, value] of Object.entries(input)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      rows.push(...flattenRecord(value as Record<string, unknown>, path));
      continue;
    }
    rows.push({ key: path, value: formatValue(value) });
  }
  return rows;
};

export const parseCsv = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }
    field += char;
  }
  row.push(field);
  if (row.some((cell) => cell.trim().length > 0)) {
    rows.push(row);
  }
  return rows;
};

export const extractRawJson = (rows: string[][]) => {
  for (const row of rows) {
    for (let i = 0; i < row.length; i += 1) {
      const key = row[i]?.replace(/^\uFEFF/, "").trim();
      if (key === "__raw_json__" && row[i + 1]) {
        return row[i + 1];
      }
    }
  }
  return null;
};
