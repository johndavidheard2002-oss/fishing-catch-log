import type { Habitat, WaterType } from "./habitat";
import type { MoonPhase } from "./moon";
import type { PressureTrend } from "./pressure";
import type { WindDirection } from "./wind";

export type { Habitat, WaterType, MoonPhase, PressureTrend, WindDirection };
export { HABITATS, WATER_TYPES } from "./habitat";
export { MOON_PHASES } from "./moon";
export { PRESSURE_TRENDS } from "./pressure";
export { WIND_DIRECTIONS } from "./wind";

export const TIME_OF_DAY = [
  "dawn",
  "morning",
  "afternoon",
  "dusk",
  "night",
] as const;

export type TimeOfDay = (typeof TIME_OF_DAY)[number];

export const SEASONS = ["spring", "summer", "fall", "winter"] as const;
export type Season = (typeof SEASONS)[number];

export const WEATHER_CONDITIONS = [
  "clear",
  "partly-cloudy",
  "cloudy",
  "overcast",
  "fog",
  "drizzle",
  "rain",
  "snow",
  "storm",
] as const;

export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number];

export const SPECIES_SOURCES = [
  "vision",
  "demo",
  "manual",
  "edited",
] as const;

export type SpeciesSource = (typeof SPECIES_SOURCES)[number];

export const TIDES = ["incoming", "high", "outgoing", "low", "slack"] as const;
export type Tide = (typeof TIDES)[number];

export const WATER_CLARITY = ["clear", "stained", "murky"] as const;
export type WaterClarity = (typeof WATER_CLARITY)[number];

export type CatchRecord = {
  id: string;
  photoPath: string | null;
  species: string;
  speciesList: string[];
  speciesSuggested: string | null;
  speciesConfidence: number | null;
  speciesSource: SpeciesSource;
  latitude: number | null;
  longitude: number | null;
  photoTakenLatitude: number | null;
  photoTakenLongitude: number | null;
  placeName: string | null;
  temperatureF: number | null;
  weatherCondition: WeatherCondition | null;
  windSpeedMph: number | null;
  windDirection: string | null;
  precipitationIn: number | null;
  humidity: number | null;
  moonPhase: string | null;
  moonIllumination: number | null;
  pressureInHg: number | null;
  pressureMb: number | null;
  pressureTrend: string | null;
  caughtAt: string;
  timeOfDay: TimeOfDay;
  season: Season;
  notes: string | null;
  bait: string | null;
  tide: string | null;
  tideHeightFt: number | null;
  tideDetail: string | null;
  waterClarity: string | null;
  habitat: Habitat;
  fishCount: number;
  speciesCounts: { species: string; count: number }[];
  anglerId: string;
  sharedWithLinked: boolean;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
};

export type CatchInput = {
  photoPath?: string | null;
  species: string;
  speciesList?: string[] | null;
  speciesSuggested?: string | null;
  speciesConfidence?: number | null;
  speciesSource?: SpeciesSource;
  latitude?: number | null;
  longitude?: number | null;
  photoTakenLatitude?: number | null;
  photoTakenLongitude?: number | null;
  placeName?: string | null;
  temperatureF?: number | null;
  weatherCondition?: WeatherCondition | null;
  windSpeedMph?: number | null;
  windDirection?: string | null;
  precipitationIn?: number | null;
  humidity?: number | null;
  moonPhase?: string | null;
  moonIllumination?: number | null;
  pressureInHg?: number | null;
  pressureMb?: number | null;
  pressureTrend?: string | null;
  caughtAt: string;
  timeOfDay?: TimeOfDay;
  season?: Season;
  notes?: string | null;
  bait?: string | null;
  tide?: string | null;
  tideHeightFt?: number | null;
  tideDetail?: string | null;
  waterClarity?: string | null;
  habitat?: Habitat | null;
  fishCount?: number | null;
  speciesCounts?: { species: string; count: number }[] | null;
  anglerId?: string | null;
  sharedWithLinked?: boolean;
};

export type CatchFilters = {
  species?: string;
  place?: string;
  from?: string;
  to?: string;
  timesOfDay?: TimeOfDay[];
  conditions?: WeatherCondition[];
  tempMin?: number;
  tempMax?: number;
  windMin?: number;
  windMax?: number;
  windDirections?: string[];
  moonPhases?: string[];
  pressureTrends?: string[];
  lat?: number;
  lng?: number;
  radiusKm?: number;
  habitats?: Habitat[];
};

export type MatchStrength = "very-strong" | "strong" | "good" | "lean";

export type SimilarMatch = {
  catch: CatchRecord;
  score: number;
  reasons: string[];
  strength: MatchStrength;
};

export type SpotGroup = {
  key: string;
  placeName: string;
  latitude: number | null;
  longitude: number | null;
  catchCount: number;
  fishCount: number;
  species: string[];
  speciesCounts: { species: string; count: number }[];
  lastCaughtAt: string;
  typicalCondition: WeatherCondition | null;
  typicalTime: TimeOfDay | null;
  avgTempF: number | null;
  catches: CatchRecord[];
};

export type WeatherSnapshot = {
  temperatureF: number | null;
  weatherCondition: WeatherCondition | null;
  windSpeedMph: number | null;
  windDirection: string | null;
  precipitationIn: number | null;
  humidity: number | null;
  moonPhase: string | null;
  moonIllumination: number | null;
  pressureInHg: number | null;
  pressureMb: number | null;
  pressureTrend: string | null;
  source: "openweather" | "open-meteo" | "demo";
  note: string;
};

export type SpeciesSuggestion = {
  species: string;
  confidence: number;
  alternatives: { species: string; confidence: number }[];
  speciesList?: string[];
  habitat?: Habitat | null;
  source: "openai" | "demo";
  note: string;
};

export type PlaceSnapshot = {
  placeName: string;
  source: "nominatim" | "coords" | "exif";
  note: string;
};

export type ProviderStatus = {
  weather: "openweather" | "demo";
  vision: "openai" | "demo";
  geocode: "nominatim";
  forecast: "openweather" | "demo";
  tides: "worldtides" | "noaa" | "demo";
};

export type ForecastWindow = {
  at: string;
  date: string;
  timeOfDay: TimeOfDay;
  season: Season;
  latitude: number;
  longitude: number;
  temperatureF: number | null;
  weatherCondition: WeatherCondition | null;
  windSpeedMph: number | null;
  windDirection: string | null;
  precipitationIn: number | null;
  humidity: number | null;
  moonPhase: string | null;
  moonIllumination: number | null;
  pressureInHg: number | null;
  pressureMb: number | null;
  pressureTrend: string | null;
  tide: Tide | null;
  tideHeightFt: number | null;
  weatherSource: "openweather" | "demo";
  tideSource: "worldtides" | "demo" | "none";
};

export type PlanMatch = {
  catch: CatchRecord;
  score: number;
  reasons: string[];
  strength: MatchStrength;
};

export type PlanSuggestion = {
  id: string;
  spotKey: string;
  placeName: string;
  latitude: number | null;
  longitude: number | null;
  window: ForecastWindow;
  score: number;
  strength: MatchStrength;
  headline: string;
  reasons: string[];
  matches: PlanMatch[];
};

export type PlanResult = {
  days: number;
  generatedAt: string;
  weatherSource: "openweather" | "demo";
  tideSource: "worldtides" | "demo";
  note: string;
  suggestions: PlanSuggestion[];
  baitSuggestions: BaitPlanSuggestion[];
};

/** A personal planned trip / calendar note — not a logged catch. */
export type CalendarNote = {
  id: string;
  anglerId: string;
  day: string;
  title: string | null;
  notes: string | null;
  placeName: string | null;
  speciesTargets: string[];
  createdAt: string;
  updatedAt: string;
};

export type CalendarNoteInput = {
  day: string;
  title?: string | null;
  notes?: string | null;
  placeName?: string | null;
  speciesTargets?: string[] | null;
};

export type NamedArea = {
  id: string | null;
  anglerId: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  source: "saved" | "catch" | "bait";
  updatedAt: string;
};

export type NamedAreaInput = {
  name: string;
  latitude?: number | null;
  longitude?: number | null;
};

export type BaitSpot = {
  id: string;
  photoPath: string | null;
  placeName: string | null;
  baitTypes: string[];
  latitude: number | null;
  longitude: number | null;
  temperatureF: number | null;
  weatherCondition: WeatherCondition | null;
  windSpeedMph: number | null;
  windDirection: string | null;
  precipitationIn: number | null;
  humidity: number | null;
  moonPhase: string | null;
  moonIllumination: number | null;
  pressureInHg: number | null;
  pressureMb: number | null;
  pressureTrend: string | null;
  loggedAt: string;
  timeOfDay: TimeOfDay;
  season: Season;
  notes: string | null;
  tide: string | null;
  tideHeightFt: number | null;
  tideDetail: string | null;
  habitat: Habitat;
  anglerId: string;
  sharedWithLinked: boolean;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
};

export type BaitSpotInput = {
  photoPath?: string | null;
  placeName?: string | null;
  baitTypes?: string[] | null;
  latitude?: number | null;
  longitude?: number | null;
  temperatureF?: number | null;
  weatherCondition?: WeatherCondition | null;
  windSpeedMph?: number | null;
  windDirection?: string | null;
  precipitationIn?: number | null;
  humidity?: number | null;
  moonPhase?: string | null;
  moonIllumination?: number | null;
  pressureInHg?: number | null;
  pressureMb?: number | null;
  pressureTrend?: string | null;
  loggedAt: string;
  timeOfDay?: TimeOfDay;
  season?: Season;
  notes?: string | null;
  tide?: string | null;
  tideHeightFt?: number | null;
  tideDetail?: string | null;
  habitat?: Habitat | null;
  anglerId?: string | null;
  sharedWithLinked?: boolean;
};

export type BaitSpotGroup = {
  key: string;
  placeName: string;
  latitude: number | null;
  longitude: number | null;
  visitCount: number;
  baitTypes: string[];
  lastLoggedAt: string;
  typicalCondition: WeatherCondition | null;
  typicalTime: TimeOfDay | null;
  avgTempF: number | null;
  spots: BaitSpot[];
};

export type BaitPlanMatch = {
  baitSpot: BaitSpot;
  score: number;
  reasons: string[];
  strength: MatchStrength;
};

export type BaitPlanSuggestion = {
  id: string;
  spotKey: string;
  placeName: string;
  baitTypes: string[];
  latitude: number | null;
  longitude: number | null;
  window: ForecastWindow;
  score: number;
  strength: MatchStrength;
  headline: string;
  reasons: string[];
  matches: BaitPlanMatch[];
};
