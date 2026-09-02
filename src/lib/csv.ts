import type { CatchRecord } from "./types";

function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function catchesToCsv(records: CatchRecord[]): string {
  const headers = [
    "id",
    "caught_at",
    "species",
    "species_suggested",
    "species_confidence",
    "species_source",
    "place_name",
    "latitude",
    "longitude",
    "temperature_f",
    "weather_condition",
    "wind_speed_mph",
    "wind_direction",
    "precipitation_in",
    "humidity",
    "moon_phase",
    "moon_illumination",
    "pressure_in_hg",
    "pressure_mb",
    "pressure_trend",
    "time_of_day",
    "season",
    "bait",
    "tide",
    "water_clarity",
    "habitat",
    "shared_with_linked",
    "owner_name",
    "notes",
  ];
  const rows = records.map((c) =>
    [
      c.id,
      c.caughtAt,
      c.species,
      c.speciesSuggested,
      c.speciesConfidence,
      c.speciesSource,
      c.placeName,
      c.latitude,
      c.longitude,
      c.temperatureF,
      c.weatherCondition,
      c.windSpeedMph,
      c.windDirection,
      c.precipitationIn,
      c.humidity,
      c.moonPhase,
      c.moonIllumination,
      c.pressureInHg,
      c.pressureMb,
      c.pressureTrend,
      c.timeOfDay,
      c.season,
      c.bait,
      c.tide,
      c.waterClarity,
      c.habitat,
      c.sharedWithLinked ? "1" : "0",
      c.ownerName,
      c.notes,
    ]
      .map(csvEscape)
      .join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}
