import Ajv from "ajv";
import schema from "../schema/stats.schema.json" with { type: "json" };

const validate = new Ajv({ allErrors: true }).compile(schema);
export const buenosAires = "America/Argentina/Buenos_Aires";
const localWeekEnd = new Intl.DateTimeFormat("en-GB", {
  timeZone: buenosAires,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function timestamp(isoTime) {
  const instant = Date.parse(isoTime);
  const day = isoTime.slice(0, 10);
  const midnight = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(instant) || !Number.isFinite(midnight.getTime())) return NaN;
  return midnight.toISOString().slice(0, 10) === day ? instant : NaN;
}

export function parseStats(candidate) {
  if (!validate(candidate)) {
    const details = validate.errors?.map(({ instancePath, message }) =>
      `${instancePath || "/"} ${message}`
    ).join("; ");
    throw new Error(`Invalid stats.json: ${details}`);
  }
  if (candidate.state.dpn_filed !== candidate.funnel.dpn) {
    throw new Error("Invalid stats.json: /state/dpn_filed must equal /funnel/dpn");
  }
  const generatedAt = timestamp(candidate.generated_at);
  if (!Number.isFinite(generatedAt)) {
    throw new Error("Invalid stats.json: /generated_at is not a valid date");
  }
  let previous = -Infinity;
  for (const [index, { week_end }] of candidate.weekly.entries()) {
    const path = `/weekly/${index}/week_end`;
    const instant = timestamp(week_end);
    if (!Number.isFinite(instant)) {
      throw new Error(`Invalid stats.json: ${path} is not a valid date`);
    }
    const { weekday, hour, minute, second } = Object.fromEntries(
      localWeekEnd.formatToParts(instant).map(({ type, value }) => [type, value])
    );
    if (weekday !== "Sun" || hour !== "21" || minute !== "00" || second !== "00") {
      throw new Error(`Invalid stats.json: ${path} is not Sunday 21:00 in Buenos Aires`);
    }
    if (instant > generatedAt) {
      throw new Error(`Invalid stats.json: ${path} is later than /generated_at`);
    }
    if (instant <= previous) {
      throw new Error(`Invalid stats.json: ${path} must be strictly later than the previous week`);
    }
    previous = instant;
  }
  const potentiallyRevealing = [
    ["/totals/outcomes", Object.values(candidate.totals.outcomes)],
    ["/by_type", Object.values(candidate.by_type)],
  ];
  if (candidate.waiting_at_start.median !== null) {
    potentiallyRevealing.push(["/waiting_at_start/buckets",
      candidate.waiting_at_start.buckets.map(({ cases }) => cases)]);
  }
  for (const [path, cells] of potentiallyRevealing) {
    if (cells.filter(cell => cell === null).length === 1) {
      throw new Error(`Invalid stats.json: ${path} needs secondary suppression`);
    }
  }
  return candidate;
}
