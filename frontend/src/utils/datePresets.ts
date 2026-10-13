export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'thisMonth'
  | 'thisQuarter'
  | 'thisYear'
  | 'custom'
  | 'allTime'
  | 'all'
  | '';

export interface DatePresetOption {
  key: DatePreset;
  label: string;
}

export const DATE_PRESETS: DatePresetOption[] = [
  { key: '', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'thisWeek', label: 'This Week' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'thisQuarter', label: 'This Quarter' },
  { key: 'thisYear', label: 'This Year' },
  { key: 'custom', label: 'Custom' },
];

/**
 * Returns formatted dates in YYYY-MM-DD for IST timezone
 */
export function getPresetDateStrings(preset: DatePreset): { startDate: string; endDate: string } {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istNow = new Date(utc + 5.5 * 3600000);

  const format = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const y = istNow.getFullYear();
  const m = istNow.getMonth();
  const d = istNow.getDate();
  const day = istNow.getDay();

  switch (preset) {
    case 'today': {
      const todayStr = format(istNow);
      return { startDate: todayStr, endDate: todayStr };
    }
    case 'yesterday': {
      const yesterday = new Date(istNow);
      yesterday.setDate(d - 1);
      const yStr = format(yesterday);
      return { startDate: yStr, endDate: yStr };
    }
    case 'thisWeek': {
      const diff = day === 0 ? 6 : day - 1;
      const monday = new Date(istNow);
      monday.setDate(d - diff);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { startDate: format(monday), endDate: format(sunday) };
    }
    case 'thisMonth': {
      const firstDay = new Date(y, m, 1);
      const lastDay = new Date(y, m + 1, 0);
      return { startDate: format(firstDay), endDate: format(lastDay) };
    }
    case 'thisQuarter': {
      const qStartMonth = Math.floor(m / 3) * 3;
      const firstDay = new Date(y, qStartMonth, 1);
      const lastDay = new Date(y, qStartMonth + 3, 0);
      return { startDate: format(firstDay), endDate: format(lastDay) };
    }
    case 'thisYear': {
      const firstDay = new Date(y, 0, 1);
      const lastDay = new Date(y, 11, 31);
      return { startDate: format(firstDay), endDate: format(lastDay) };
    }
    default:
      return { startDate: '', endDate: '' };
  }
}

