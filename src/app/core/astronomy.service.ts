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
}
