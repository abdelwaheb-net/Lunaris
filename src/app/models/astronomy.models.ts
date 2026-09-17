export interface Location {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface SunData {
  sunrise: Date;
  sunset: Date;
  solarNoon: Date;
  dayLength: number;
  altitude: number;
}

export interface MoonData {
  rise: Date | null;
  set: Date | null;
  phase: number;
  illumination: number;
}
