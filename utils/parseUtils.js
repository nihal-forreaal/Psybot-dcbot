'use strict';

/**
 * Extracts a Discord user ID from a mention string (<@123…>) or a raw ID.
 * Returns `null` if the input is invalid.
 * @param {string|null|undefined} input
 * @returns {string|null}
 */
function parseUserId(input) {
  if (!input) return null;
  const mentionMatch = input.trim().match(/^<@!?(\d+)>$/);
  if (mentionMatch) return mentionMatch[1];
  const idMatch = input.trim().match(/^(\d{17,19})$/);
  return idMatch ? idMatch[1] : null;
}

/**
 * Parses a human-readable time string (e.g. "10am", "2:30pm", "14:00") on a
 * given YYYY-MM-DD date string into a UTC epoch millisecond value, accounting
 * for IST (UTC+5:30).
 * Returns `null` on invalid input.
 * @param {string} date   YYYY-MM-DD
 * @param {string} time   e.g. "10am", "2:30pm", "14:00"
 * @returns {number|null}
 */
function parseTime(date, time) {
  const match = time.trim().toLowerCase().match(/^(\d+)(?::(\d+))?\s*(am|pm)?$/);
  if (!match) return null;

  let hours = parseInt(match[1]);
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const ampm = match[3];

  if (ampm === 'pm' && hours < 12) hours += 12;
  if (ampm === 'am' && hours === 12) hours = 0;

  const dateParts = date.split('-');
  if (dateParts.length !== 3) return null;

  const y = parseInt(dateParts[0]);
  const m = parseInt(dateParts[1]) - 1;
  const d = parseInt(dateParts[2]);

  const utcDate = new Date(Date.UTC(y, m, d, hours, minutes));
  return utcDate.getTime() - (5.5 * 60 * 60 * 1000); // Convert IST → UTC ms
}

module.exports = { parseUserId, parseTime };
