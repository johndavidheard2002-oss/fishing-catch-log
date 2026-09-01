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
  speciesSuggested: string | null;
  speciesConfidence: number | null;
  speciesSource: SpeciesSource;
  latitude: number | null;
  longitude: number | null;
  placeName: string | null;
  temperatureF: number | null;
  weatherCondition: WeatherCondition | null;
  windSpeedMph: number | null;
  precipitationIn: number | null;
  humidity: number | null;
  caughtAt: string;
  timeOfDay: TimeOfDay;
  season: Season;
  notes: string | null;
  bait: string | null;
  tide: string | null;
  waterClarity: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CatchInput = {
  photoPath?: string | null;
  species: string;
  speciesSuggested?: string | null;
  speciesConfidence?: number | null;
  speciesSource?: SpeciesSource;
  latitude?: number | null;
  longitude?: number | null;
  placeName?: string | null;
  temperatureF?: number | null;
  weatherCondition?: WeatherCondition | null;
  windSpeedMph?: number | null;
  precipitationIn?: number | null;
  humidity?: number | null;
  caughtAt: string;
  timeOfDay?: TimeOfDay;
  season?: Season;
  notes?: string | null;
  bait?: string | null;
  tide?: string | null;
  waterClarity?: string | null;
};

export type CatchFilters = {
  species?: string;
  place?: string;
  from?: string;
  to?: string;
  seasons?: Season[];
  timesOfDay?: TimeOfDay[];
  conditions?: WeatherCondition[];
  tempMin?: number;
  tempMax?: number;
  windMin?: number;
  windMax?: number;
  lat?: number;
  lng?: number;
  radiusKm?: number;
};

export type SimilarMatch = {
  catch: CatchRecord;
  score: number;
  reasons: string[];
};

export type SpotGroup = {
  key: string;
  placeName: string;
  latitude: number | null;
  longitude: number | null;
  catchCount: number;
  species: string[];
  lastCaughtAt: string;
  typicalCondition: WeatherCondition | null;
  typicalSeason: Season | null;
  typicalTime: TimeOfDay | null;
  avgTempF: number | null;
  catches: CatchRecord[];
};

export type WeatherSnapshot = {
  temperatureF: number | null;
  weatherCondition: WeatherCondition | null;
  windSpeedMph: number | null;
  precipitationIn: number | null;
  humidity: number | null;
  source: "openweather" | "demo";
  note: string;
};

export type SpeciesSuggestion = {
  species: string;
  confidence: number;
  alternatives: { species: string; confidence: number }[];
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
};
