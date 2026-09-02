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
    "species_list",
    "species_suggested",
    "species_confidence",
    "species_source",
    "place_name",
    "latitude",
    "longitude",
    "photo_taken_latitude",
    "photo_taken_longitude",
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
    "tide_height_ft",
    "tide_detail",
    "water_clarity",
    "habitat",
    "fish_count",
    "species_counts",
    "shared_with_linked",
    "owner_name",
    "notes",
  ];
  const rows = records.map((c) =>
    [
      c.id,
      c.caughtAt,
      c.species,
      (c.speciesList ?? []).join("; "),
      c.speciesSuggested,
      c.speciesConfidence,
      c.speciesSource,
      c.placeName,
      c.latitude,
      c.longitude,
      c.photoTakenLatitude,
      c.photoTakenLongitude,
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
      c.tideHeightFt,
      c.tideDetail,
      c.waterClarity,
      c.habitat,
      c.fishCount,
      (c.speciesCounts ?? []).map((row) => `${row.species}:${row.count}`).join("; "),
      c.sharedWithLinked ? "1" : "0",
      c.ownerName,
      c.notes,
    ]
      .map(csvEscape)
      .join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}
