export interface DateRangeQuery {
  dateRange?: string;
  startDate?: string;
  endDate?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface DateFilterBoundary {
  gte?: Date;
  lte?: Date;
}

/**
 * Calculates date range boundaries in Asia/Kolkata (IST: UTC+5:30) timezone.
 */
export function getDateRangeBoundaries(
  preset?: string,
  customStart?: string,
  customEnd?: string
): DateFilterBoundary | null {
  if (!preset && !customStart && !customEnd) return null;

  // Current time in IST (offset +5.5 hours = 330 minutes)
  const now = new Date();
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  const istOffset = 5.5 * 3600000;
  const istNow = new Date(utcTime + istOffset);

  const istYear = istNow.getFullYear();
  const istMonth = istNow.getMonth(); // 0-indexed
  const istDate = istNow.getDate();
  const istDay = istNow.getDay(); // 0 is Sunday, 1 is Monday...

  const createIstDate = (
    year: number,
    month: number,
    date: number,
    hours = 0,
    minutes = 0,
    seconds = 0,
    ms = 0
  ) => {
    return new Date(Date.UTC(year, month, date, hours - 5, minutes - 30, seconds, ms));
  };

  const normalizedPreset = (preset || '').toLowerCase();

  if (
    normalizedPreset === 'all' ||
    normalizedPreset === 'alltime' ||
    normalizedPreset === 'all_time' ||
    !normalizedPreset
  ) {
    if (!customStart && !customEnd) return null;
  }

  if (normalizedPreset === 'today') {
    return {
      gte: createIstDate(istYear, istMonth, istDate, 0, 0, 0, 0),
      lte: createIstDate(istYear, istMonth, istDate, 23, 59, 59, 999),
    };
  }

  if (normalizedPreset === 'yesterday') {
    return {
      gte: createIstDate(istYear, istMonth, istDate - 1, 0, 0, 0, 0),
      lte: createIstDate(istYear, istMonth, istDate - 1, 23, 59, 59, 999),
    };
  }

  if (
    normalizedPreset === 'thisweek' ||
    normalizedPreset === 'week' ||
    normalizedPreset === 'this_week'
  ) {
    // Monday as start of week in IST
    const dayDiff = istDay === 0 ? 6 : istDay - 1;
    const mondayDate = istDate - dayDiff;
    return {
      gte: createIstDate(istYear, istMonth, mondayDate, 0, 0, 0, 0),
      lte: createIstDate(istYear, istMonth, mondayDate + 6, 23, 59, 59, 999),
    };
  }

  if (
    normalizedPreset === 'thismonth' ||
    normalizedPreset === 'month' ||
    normalizedPreset === 'this_month'
  ) {
    const lastDayOfMonth = new Date(istYear, istMonth + 1, 0).getDate();
    return {
      gte: createIstDate(istYear, istMonth, 1, 0, 0, 0, 0),
      lte: createIstDate(istYear, istMonth, lastDayOfMonth, 23, 59, 59, 999),
    };
  }

  if (
    normalizedPreset === 'thisquarter' ||
    normalizedPreset === 'quarter' ||
    normalizedPreset === 'this_quarter'
  ) {
    const quarterStartMonth = Math.floor(istMonth / 3) * 3;
    const quarterEndMonth = quarterStartMonth + 2;
    const lastDayOfQuarter = new Date(istYear, quarterEndMonth + 1, 0).getDate();
    return {
      gte: createIstDate(istYear, quarterStartMonth, 1, 0, 0, 0, 0),
      lte: createIstDate(istYear, quarterEndMonth, lastDayOfQuarter, 23, 59, 59, 999),
    };
  }

  if (
    normalizedPreset === 'thisyear' ||
    normalizedPreset === 'year' ||
    normalizedPreset === 'this_year'
  ) {
    return {
      gte: createIstDate(istYear, 0, 1, 0, 0, 0, 0),
      lte: createIstDate(istYear, 11, 31, 23, 59, 59, 999),
    };
  }

  if (normalizedPreset === 'custom' || customStart || customEnd) {
    let gte: Date | undefined;
    let lte: Date | undefined;
    if (customStart) {
      const parts = customStart.split('-').map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        gte = createIstDate(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
      }
    }
    if (customEnd) {
      const parts = customEnd.split('-').map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        lte = createIstDate(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
      }
    }
    if (gte || lte) {
      return { gte, lte };
    }
  }

  return null;
}

/**
 * Extracts and maps date range parameters from incoming HTTP queries into a Prisma DateTimeFilter.
 */
export function buildPrismaDateFilter(query: DateRangeQuery): { gte?: Date; lte?: Date } | undefined {
  const customStart = query.startDate || query.dateFrom;
  const customEnd = query.endDate || query.dateTo;
  const boundary = getDateRangeBoundaries(query.dateRange, customStart, customEnd);
  return boundary || undefined;
}

