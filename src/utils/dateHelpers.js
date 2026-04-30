// ─────────────────────────────────────────────
//  dateHelpers.js
//  All date/time formatting used across the app
//  Output format: DD-MMM-YYYY HH:MM AM/PM
//  e.g.  28-Apr-2026 3:45 PM
// ─────────────────────────────────────────────

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Returns the current date-time as a readable string.
 * Format: DD-MMM-YYYY H:MM AM/PM
 * Example: 28-Apr-2026 3:45 PM
 *
 * @returns {string}
 */
export function getNowTimestamp() {
  return formatTimestamp(new Date());
}

/**
 * Formats any Date object into the app's standard timestamp string.
 * Format: DD-MMM-YYYY H:MM AM/PM
 *
 * @param {Date} date
 * @returns {string}
 */
export function formatTimestamp(date) {
  const dd  = String(date.getDate()).padStart(2, '0');
  const mmm = MONTH_ABBR[date.getMonth()];
  const yyyy = date.getFullYear();

  let hours   = date.getHours();
  const mins  = String(date.getMinutes()).padStart(2, '0');
  const ampm  = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  if (hours === 0) hours = 12; // midnight / noon edge case

  return `${dd}-${mmm}-${yyyy} ${hours}:${mins} ${ampm}`;
}

/**
 * Returns today's date as a short string for display headers.
 * Format: DD MMM YYYY
 * Example: 28 Apr 2026
 *
 * @returns {string}
 */
export function getTodayDisplay() {
  const d = new Date();
  const dd  = String(d.getDate()).padStart(2, '0');
  const mmm = MONTH_ABBR[d.getMonth()];
  const yyyy = d.getFullYear();
  return `${dd} ${mmm} ${yyyy}`;
}

/**
 * Parses a timestamp string back into a Date object.
 * Useful if you ever need to sort or compare entries.
 * Handles format: DD-MMM-YYYY H:MM AM/PM
 *
 * @param {string} ts  e.g. "28-Apr-2026 3:45 PM"
 * @returns {Date|null}
 */
export function parseTimestamp(ts) {
  try {
    // "28-Apr-2026 3:45 PM"  →  split into date and time parts
    const [datePart, timePart, ampm] = ts.split(' ');
    const [dd, mmm, yyyy] = datePart.split('-');
    const [hh, mm] = timePart.split(':');

    let hours = parseInt(hh, 10);
    if (ampm === 'PM' && hours !== 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;

    const monthIndex = MONTH_ABBR.indexOf(mmm);
    if (monthIndex === -1) return null;

    return new Date(
      parseInt(yyyy, 10),
      monthIndex,
      parseInt(dd, 10),
      hours,
      parseInt(mm, 10),
    );
  } catch {
    return null;
  }
}

/**
 * Returns a filename-safe date string for use in exports.
 * Format: YYYYMMDD
 * Example: 20260428
 *
 * @returns {string}
 */
export function getFileDateStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}