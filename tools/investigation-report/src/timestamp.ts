export const investigationTimestampPatternSource =
  "^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2}):(\\d{2})(Z|[+-]\\d{2}:\\d{2})$";

const investigationTimestampPattern = new RegExp(
  investigationTimestampPatternSource,
  "u"
);

function isCalendarDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (match === null) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function investigationTimestampMilliseconds(value: string): number | null {
  const match = value.match(investigationTimestampPattern);
  if (match === null) {
    return null;
  }
  const datePart = `${match[1]}-${match[2]}-${match[3]}`;
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (
    !isCalendarDate(datePart)
    || hour > 23
    || minute > 59
    || second > 59
  ) {
    return null;
  }
  if (match[7] !== "Z") {
    const offsetHour = Number(match[7].slice(1, 3));
    const offsetMinute = Number(match[7].slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) {
      return null;
    }
  }
  const milliseconds = Date.parse(value);
  return Number.isNaN(milliseconds) ? null : milliseconds;
}
