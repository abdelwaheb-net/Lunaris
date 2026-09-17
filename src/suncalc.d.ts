declare module 'suncalc' {
  export interface SunTimes {
    sunrise: Date;
    sunset: Date;
    solarNoon: Date;
    night: Date;
    nightEnd: Date;
  }

  export interface MoonTimes { rise?: Date; set?: Date; }
  export interface MoonIllumination { fraction: number; phase: number; angle: number; }
  export interface Position { azimuth: number; altitude: number; }
  export interface MoonPosition extends Position { distance: number; parallacticAngle: number; }

  export function getTimes(date: Date, latitude: number, longitude: number, height?: number): SunTimes;
  export function getMoonTimes(date: Date, latitude: number, longitude: number, inUTC?: boolean): MoonTimes;
  export function getMoonIllumination(date?: Date): MoonIllumination;
  export function getPosition(date: Date, latitude: number, longitude: number): Position;
  export function getMoonPosition(date: Date, latitude: number, longitude: number): MoonPosition;
}
