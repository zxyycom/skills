export const measurement: {
  active: boolean;
  fixtureRoot: string;
  counts: Record<string, number>;
} = {
  active: false,
  fixtureRoot: "",
  counts: {}
};

export function count(name: string, amount = 1): void {
  if (measurement.active)
    measurement.counts[name] = (measurement.counts[name] ?? 0) + amount;
}
