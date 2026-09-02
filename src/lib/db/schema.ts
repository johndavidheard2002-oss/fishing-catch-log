import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const catches = sqliteTable("catches", {
  id: text("id").primaryKey(),
  photoPath: text("photo_path"),
  species: text("species").notNull(),
  speciesSuggested: text("species_suggested"),
  speciesConfidence: real("species_confidence"),
  speciesSource: text("species_source").notNull().default("manual"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  placeName: text("place_name"),
  temperatureF: real("temperature_f"),
  weatherCondition: text("weather_condition"),
  windSpeedMph: real("wind_speed_mph"),
  precipitationIn: real("precipitation_in"),
  humidity: integer("humidity"),
  caughtAt: text("caught_at").notNull(),
  timeOfDay: text("time_of_day").notNull(),
  season: text("season").notNull(),
  notes: text("notes"),
  bait: text("bait"),
  tide: text("tide"),
  waterClarity: text("water_clarity"),
  habitat: text("habitat").notNull().default("freshwater"),
  anglerId: text("angler_id"),
  sharedWithLinked: integer("shared_with_linked").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const anglers = sqliteTable("anglers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull(),
  createdAt: text("created_at").notNull(),
});

export const buddyLinks = sqliteTable("buddy_links", {
  id: text("id").primaryKey(),
  anglerId: text("angler_id").notNull(),
  buddyId: text("buddy_id").notNull(),
  createdAt: text("created_at").notNull(),
});
