import { Injectable } from '@angular/core';
import * as SunCalc from 'suncalc';
import { Location, MoonData, SunData } from '../models/astronomy.models';

@Injectable({ providedIn: 'root' })
export class AstronomyService {
  sun(date: Date, place: Location): SunData {
    const times = SunCalc.getTimes(date, place.latitude, place.longitude);
    const position = SunCalc.getPosition(date, place.latitude, place.longitude);
    return { sunrise: times.sunrise, sunset: times.sunset, solarNoon: times.solarNoon, dayLength: times.sunset.getTime() - times.sunrise.getTime(), altitude: position.altitude };
  }

  moon(date: Date, place: Location): MoonData {
    const times = SunCalc.getMoonTimes(date, place.latitude, place.longitude);
    const phase = SunCalc.getMoonIllumination(date);
    return { rise: times.rise ?? null, set: times.set ?? null, phase: phase.phase, illumination: phase.fraction };
  }

  /**
   * Lunar data for one civil calendar day in the selected location.
   * Rise/set events are gathered from adjacent UTC days then filtered by the
   * location timezone so a Paris/Tokyo/etc. selection never inherits the
   * browser's own timezone boundaries.
   */
  moonForCalendarDate(year: number, month: number, day: number, place: Location): MoonData {
    const sample = this.zonedDateToUtc(year, month, day, 12, place.timezone);
    const phase = SunCalc.getMoonIllumination(sample);
    const targetKey = this.calendarKey(year, month, day);
    const rises: Date[] = [];
    const sets: Date[] = [];

    for (const offset of [-1, 0, 1]) {
      const utcDay = new Date(Date.UTC(year, month, day + offset, 12));
      const times = SunCalc.getMoonTimes(utcDay, place.latitude, place.longitude, true);
      if (times.rise && this.dateKeyInTimeZone(times.rise, place.timezone) === targetKey) rises.push(times.rise);
      if (times.set && this.dateKeyInTimeZone(times.set, place.timezone) === targetKey) sets.push(times.set);
    }

    rises.sort((a, b) => a.getTime() - b.getTime());
    sets.sort((a, b) => a.getTime() - b.getTime());
    return {
      rise: rises[0] ?? null,
      set: sets[0] ?? null,
      phase: phase.phase,
      illumination: phase.fraction
    };
  }

  phaseName(phase: number): string {
    if (phase < .03 || phase > .97) return 'Nouvelle lune';
    if (phase < .22) return 'Premier croissant';
    if (phase < .28) return 'Premier quartier';
    if (phase < .47) return 'Gibbeuse croissante';
    if (phase < .53) return 'Pleine lune';
    if (phase < .72) return 'Gibbeuse décroissante';
    if (phase < .78) return 'Dernier quartier';
    return 'Dernier croissant';
  }

  prayerTimes(date: Date, place: Location): { fajr: Date; dhuhr: Date; maghrib: Date; isha: Date } {
    // SunCalc exposes the standard astronomical (-18°) dawn/dusk as nightEnd/night.
    const times = SunCalc.getTimes(date, place.latitude, place.longitude);
    return { fajr: times.nightEnd, dhuhr: times.solarNoon, maghrib: times.sunset, isha: times.night };
  }

  private dateKeyInTimeZone(date: Date, timeZone: string): string {
    const parts = this.partsInTimeZone(date, timeZone);
    return this.calendarKey(parts.year, parts.month - 1, parts.day);
  }

  private calendarKey(year: number, month: number, day: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private zonedDateToUtc(year: number, month: number, day: number, hour: number, timeZone: string): Date {
    const desired = Date.UTC(year, month, day, hour, 0, 0);
    let guess = desired;

    // Two passes handle almost all timezone/DST offsets without a timezone library.
    for (let pass = 0; pass < 2; pass++) {
      const actual = this.partsInTimeZone(new Date(guess), timeZone);
      const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, 0);
      guess += desired - represented;
    }
    return new Date(guess);
  }

  private partsInTimeZone(date: Date, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number } {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).formatToParts(date);
      const read = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find(part => part.type === type)?.value ?? 0);
      return { year: read('year'), month: read('month'), day: read('day'), hour: read('hour'), minute: read('minute') };
    } catch {
      return {
        year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(),
        hour: date.getHours(), minute: date.getMinutes()
      };
    }
  }
}
