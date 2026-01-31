// Minimal CSV parser that supports:
// - comma delimiter
// - quoted fields
// - escaped quotes ("")
// - CRLF/LF newlines
// Keeps everything as strings.

export function parseCSV(text: string): string[][] {
  const input = (text ?? '').replace(/^\uFEFF/, ''); // strip BOM

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };

  const pushRow = () => {
    // Ignore completely empty trailing rows
    if (row.length === 1 && row[0] === '') {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        const next = input[i + 1];
        // Escaped quote
        if (next === '"') {
          field += '"';
          i++;
          continue;
        }
        inQuotes = false;
        continue;
      }

      field += char;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      pushField();
      continue;
    }

    if (char === '\n') {
      pushField();
      pushRow();
      continue;
    }

    if (char === '\r') {
      // Handle CRLF by consuming the next \n
      const next = input[i + 1];
      if (next === '\n') i++;
      pushField();
      pushRow();
      continue;
    }

    field += char;
  }

  // flush last field/row
  pushField();
  if (row.length > 0) pushRow();

  return rows;
}
