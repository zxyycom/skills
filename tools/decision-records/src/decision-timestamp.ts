export const decisionTimestampPatternSource = String.raw`^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|[+-](\d{2}):(\d{2}))$`;

const rfc3339TimestampPattern = new RegExp(decisionTimestampPatternSource);

export function isDecisionTimestamp(value: string): boolean {
  const match = value.match(rfc3339TimestampPattern);
  return match !== null && timestampPartsAreValid(timestampParts(match));
}

type DecisionTimestampParts = Readonly<{
  day: number;
  hour: number;
  minute: number;
  month: number;
  offsetHour: number;
  offsetMinute: number;
  second: number;
  year: number;
}>;

function timestampParts(match: RegExpMatchArray): DecisionTimestampParts {
  return {
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    month: Number(match[2]),
    offsetHour: Number(match[8] ?? 0),
    offsetMinute: Number(match[9] ?? 0),
    second: Number(match[6]),
    year: Number(match[1])
  };
}

function timestampPartsAreValid(parts: DecisionTimestampParts): boolean {
  return validCalendarDate(parts) && validClockAndOffset(parts);
}

function validCalendarDate({
  day,
  month,
  year
}: DecisionTimestampParts): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validClockAndOffset(parts: DecisionTimestampParts): boolean {
  return (
    parts.hour <= 23 &&
    parts.minute <= 59 &&
    parts.second <= 59 &&
    parts.offsetHour <= 23 &&
    parts.offsetMinute <= 59
  );
}

export function decisionTimestampMilliseconds(value: string): number | null {
  if (!isDecisionTimestamp(value)) return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}
