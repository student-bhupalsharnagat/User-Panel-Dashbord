/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const MONTH_MAP: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

export interface ISTDateInfo {
  year: number;
  month: number;
  day: number;
  dateStr: string; // 'YYYY-MM-DD'
}

/**
 * Returns the calendar date in Indian Standard Time (IST, UTC+05:30).
 */
export function getISTDate(d: Date = new Date()): ISTDateInfo {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const dateStr = formatter.format(d); // Formats as 'YYYY-MM-DD'
    const [year, month, day] = dateStr.split('-').map(Number);
    return { year, month, day, dateStr };
  } catch {
    // Fallback using UTC offset +05:30 if Intl fails
    const utcTime = d.getTime() + (d.getTimezoneOffset() * 60000);
    const istTime = new Date(utcTime + (5.5 * 3600000));
    const year = istTime.getFullYear();
    const month = istTime.getMonth() + 1;
    const day = istTime.getDate();
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { year, month, day, dateStr };
  }
}

/**
 * Returns yesterday's calendar date in IST.
 */
export function getISTYesterday(): ISTDateInfo {
  const today = getISTDate();
  // Create UTC noon for today and subtract 24h
  const d = new Date(Date.UTC(today.year, today.month - 1, today.day - 1, 12, 0, 0));
  return getISTDate(d);
}

/**
 * Parses any date format (ISO, 'YYYY-MM-DD', '19 Oct 2026', '22 Apr, 10:24',
 * or time-only '08:12:25') into a normalized IST calendar date.
 */
export function parseRecordDate(raw: any): ISTDateInfo | null {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? null : getISTDate(raw);
  }

  const str = String(raw).trim();
  if (!str) return null;

  const today = getISTDate();
  const yesterday = getISTYesterday();

  // 1. Time-only strings (e.g. '08:12:25', '14:30', '09:15:00 AM') default to Today in IST
  if (/^\d{1,2}:\d{2}(:\d{2})?(\s*(am|pm))?$/i.test(str)) {
    return today;
  }

  // 2. Relative keywords 'Today' / 'Yesterday'
  if (/\btoday\b/i.test(str)) {
    return today;
  }
  if (/\byesterday\b/i.test(str)) {
    return yesterday;
  }

  // 3. 'YYYY-MM-DD' exact format (or starting with 'YYYY-MM-DD' without T)
  const isoDateMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoDateMatch && !str.includes('T')) {
    const year = Number(isoDateMatch[1]);
    const month = Number(isoDateMatch[2]);
    const day = Number(isoDateMatch[3]);
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { year, month, day, dateStr };
  }

  // 4. Full ISO 8601 with time/timezone (e.g. '2026-10-22T19:15:16.000Z')
  if (str.includes('T')) {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return getISTDate(parsed);
    }
  }

  // 5. 'DD Mon YYYY' or 'DD-Mon-YYYY' or 'DD Mon, YYYY' (e.g. '19 Oct 2026', '22 Apr, 2026')
  const dmyMatch = str.match(/^(\d{1,2})[\s\-\/]([a-zA-Z]+)[\s\-\/,]+(\d{4})/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const monthKey = dmyMatch[2].toLowerCase();
    const month = MONTH_MAP[monthKey];
    const year = Number(dmyMatch[3]);
    if (month) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { year, month, day, dateStr };
    }
  }

  // 6. 'DD Mon, HH:mm' or 'DD Mon' (e.g. '22 Apr, 10:24', '19 Oct') - defaults to current IST year
  const dmMatch = str.match(/^(\d{1,2})[\s\-\/]([a-zA-Z]+)/);
  if (dmMatch) {
    const day = Number(dmMatch[1]);
    const monthKey = dmMatch[2].toLowerCase();
    const month = MONTH_MAP[monthKey];
    if (month) {
      const year = today.year;
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { year, month, day, dateStr };
    }
  }

  // 7. General JavaScript Date parse fallback
  const fallbackDate = new Date(str);
  if (!isNaN(fallbackDate.getTime())) {
    return getISTDate(fallbackDate);
  }

  return null;
}

/**
 * Checks whether a given record date matches the specified date filter string.
 * Supports: 'Today', 'Yesterday', '7 Days', '30 Days', '90 Days', 'This Month', 'This Week', 'Fiscal Q1', 'All'.
 */
export function matchesDateFilter(rawDate: any, filter: string): boolean {
  if (!filter || filter === 'All' || filter === 'all' || filter === 'All statuses') {
    return true;
  }

  const parsed = parseRecordDate(rawDate);
  if (!parsed) return false;

  const today = getISTDate();
  const yesterday = getISTYesterday();

  const norm = filter.trim().toLowerCase();

  if (norm === 'today') {
    return parsed.dateStr === today.dateStr;
  }

  if (norm === 'yesterday') {
    return parsed.dateStr === yesterday.dateStr;
  }

  // Calculate day difference (today - parsed)
  const todayMs = Date.UTC(today.year, today.month - 1, today.day);
  const parsedMs = Date.UTC(parsed.year, parsed.month - 1, parsed.day);
  const diffDays = Math.round((todayMs - parsedMs) / (1000 * 60 * 60 * 24));

  if (norm === 'this week' || norm === '7 days' || norm === 'last 7 days') {
    return diffDays >= 0 && diffDays <= 7;
  }

  if (norm === '30 days' || norm === 'last 30 days') {
    return diffDays >= 0 && diffDays <= 30;
  }

  if (norm === '90 days' || norm === 'last 90 days') {
    return diffDays >= 0 && diffDays <= 90;
  }

  if (norm === 'this month') {
    return parsed.year === today.year && parsed.month === today.month;
  }

  if (norm === 'fiscal q1') {
    // April, May, June (Q1 of Indian Financial Year)
    return parsed.month >= 4 && parsed.month <= 6;
  }

  return true;
}
