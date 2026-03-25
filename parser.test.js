// parser.test.js — run with: node parser.test.js
// Tests for the RFC 4180 CSV parser

function parseCSV(text) {
  const rows = []; let row = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i+1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    }
    else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg || ''}\n    expected: ${b}\n    got:      ${a}`);
}

console.log('\nCSV Parser Tests\n');

test('simple two-column row', () => {
  const rows = parseCSV('Name,Nights\nAlex,17\n');
  assertEqual(rows.length, 2);
  assertEqual(rows[0], ['Name', 'Nights']);
  assertEqual(rows[1], ['Alex', '17']);
});

test('quoted field with comma inside', () => {
  const rows = parseCSV('Name,Nights\n"Murphy, Ciaran",5\n');
  assertEqual(rows[1][0], 'Murphy, Ciaran');
  assertEqual(rows[1][1], '5');
});

test('escaped double-quote inside quoted field', () => {
  const rows = parseCSV('Name,Note\n"He said ""hi""",17\n');
  assertEqual(rows[1][0], 'He said "hi"');
});

test('\\r\\n line endings (Windows CSV)', () => {
  const rows = parseCSV('Name,Nights\r\nAlex,17\r\nDonna,14\r\n');
  assertEqual(rows.length, 3);
  assertEqual(rows[1], ['Alex', '17']);
  assertEqual(rows[2], ['Donna', '14']);
});

test('empty trailing row is parsed as a row (caller must filter)', () => {
  const rows = parseCSV('Name,Nights\nAlex,17\n');
  // The trailing \n creates an implicit empty last row in some parsers.
  // Our parser includes the header + data rows; caller filters rows where name is blank.
  const dataRows = rows.slice(1).filter(r => r[0] !== '');
  assertEqual(dataRows.length, 1);
  assertEqual(dataRows[0][0], 'Alex');
});

test('multiple rows', () => {
  const rows = parseCSV('Name,Nights\nAlex,17\nDonna,14\nKim,7\n');
  assertEqual(rows.length, 4);
  assertEqual(rows[3], ['Kim', '7']);
});

test('empty cell in the middle', () => {
  const rows = parseCSV('Name,Badge,Nights\nAlex,,17\n');
  assertEqual(rows[1], ['Alex', '', '17']);
});

test('quoted empty field', () => {
  const rows = parseCSV('Name,Badge\nAlex,""\n');
  assertEqual(rows[1], ['Alex', '']);
});

test('no trailing newline', () => {
  const rows = parseCSV('Name,Nights\nAlex,17');
  assertEqual(rows.length, 2);
  assertEqual(rows[1], ['Alex', '17']);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
