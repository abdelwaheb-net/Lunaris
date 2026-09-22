import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { DecimalPipe, NgStyle } from '@angular/common';
import * as SunCalc from 'suncalc';
import { Location, MoonData } from '../../models/astronomy.models';
import { AstronomyService } from '../../core/astronomy.service';

type CalendarMode = 'month' | 'year';

interface MoonDay {
  year: number;
  month: number;
  day: number;
  key: string;
  phase: number;
  illumination: number;
  name: string;
  icon: string;
  today: boolean;
  major: boolean;
}

interface MoonMonth {
  month: number;
  name: string;
  offset: number;
  days: MoonDay[];
}

interface MoonDayDetails extends MoonDay {
  rise: Date | null;
  set: Date | null;
  dateLabel: string;
}

@Component({
  selector: 'app-moon-tracker',
  standalone: true,
  imports: [DecimalPipe, NgStyle],
  templateUrl: './moon-tracker.component.html',
  styleUrl: './moon-tracker.component.css'
})
export class MoonTrackerComponent implements OnChanges {
  @Input({ required: true }) location!: Location;
  @Input({ required: true }) moment!: Date;

  protected altitude = 0;
  protected bearing = 0;
  protected illumination = 0;
  protected phaseName = '';
  protected currentIcon = '🌙';
  protected todayMoon: MoonData = { rise: null, set: null, phase: 0, illumination: 0 };

  protected mode: CalendarMode = 'month';
  protected viewYear = new Date().getFullYear();
  protected viewMonth = new Date().getMonth();
  protected monthCalendar: MoonMonth = { month: 0, name: '', offset: 0, days: [] };
  protected yearCalendar: MoonMonth[] = [];
  protected selectedDay: MoonDayDetails | null = null;
  protected readonly monthNames = Array.from({ length: 12 }, (_, month) =>
    new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date(2024, month, 1))
  );

  private initialized = false;
  private todayKey = '';

  constructor(protected readonly astronomy: AstronomyService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.location || !this.moment) return;
    this.refreshCurrent();

    const localToday = this.localDateParts(this.moment);
    const newTodayKey = this.key(localToday.year, localToday.month, localToday.day);

    if (!this.initialized) {
      this.viewYear = localToday.year;
      this.viewMonth = localToday.month;
      this.todayKey = newTodayKey;
      this.rebuildCalendars();
      this.selectDate(localToday.year, localToday.month, localToday.day);
      this.initialized = true;
      return;
    }

    if (changes['location']) {
      this.todayKey = newTodayKey;
      this.rebuildCalendars();
      if (this.selectedDay) this.selectDate(this.selectedDay.year, this.selectedDay.month, this.selectedDay.day);
      return;
    }

    if (newTodayKey !== this.todayKey) {
      this.todayKey = newTodayKey;
      this.rebuildCalendars();
    }
  }

  protected compassPosition(): Record<string, string> {
    const radius = 28 + (Math.max(0, Math.min(75, this.altitude)) / 75) * 27;
    const radians = (this.bearing - 90) * Math.PI / 180;
    return { left: `${50 + Math.cos(radians) * radius}%`, top: `${50 + Math.sin(radians) * radius}%` };
  }

  protected setMode(mode: CalendarMode): void {
    this.mode = mode;
    if (mode === 'year' && this.yearCalendar.length === 0) this.yearCalendar = this.buildYear(this.viewYear);
  }

  protected previousPeriod(): void {
    if (this.mode === 'year') {
      this.viewYear -= 1;
      this.rebuildCalendars();
      return;
    }
    if (this.viewMonth === 0) { this.viewMonth = 11; this.viewYear -= 1; }
    else this.viewMonth -= 1;
    this.rebuildCalendars();
  }

  protected nextPeriod(): void {
    if (this.mode === 'year') {
      this.viewYear += 1;
      this.rebuildCalendars();
      return;
    }
    if (this.viewMonth === 11) { this.viewMonth = 0; this.viewYear += 1; }
    else this.viewMonth += 1;
    this.rebuildCalendars();
  }

  protected goToday(): void {
    const today = this.localDateParts(this.moment);
    this.viewYear = today.year;
    this.viewMonth = today.month;
    this.mode = 'month';
    this.rebuildCalendars();
    this.selectDate(today.year, today.month, today.day);
  }

  protected setMonth(month: number): void {
    if (!Number.isInteger(month) || month < 0 || month > 11) return;
    this.viewMonth = month;
    this.mode = 'month';
    this.rebuildCalendars();
  }

  protected setYear(year: number): void {
    if (!Number.isFinite(year)) return;
    this.viewYear = Math.max(1900, Math.min(2100, Math.trunc(year)));
    this.rebuildCalendars();
  }

  protected openMonth(month: number): void {
    this.viewMonth = month;
    this.mode = 'month';
    this.rebuildCalendars();
  }

  protected select(day: MoonDay): void {
    this.selectDate(day.year, day.month, day.day);
  }

  protected formatTime(date: Date | null): string {
    if (!date) return '—';
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        timeZone: this.location.timezone,
        hour: '2-digit', minute: '2-digit', hour12: false
      }).format(date);
    } catch {
      return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
    }
  }

  protected isSelected(day: MoonDay): boolean {
    return this.selectedDay?.key === day.key;
  }

  private refreshCurrent(): void {
    const position = SunCalc.getMoonPosition(this.moment, this.location.latitude, this.location.longitude);
    const illumination = SunCalc.getMoonIllumination(this.moment);
    this.altitude = position.altitude * 180 / Math.PI;
    this.bearing = (position.azimuth * 180 / Math.PI + 180 + 360) % 360;
    this.illumination = illumination.fraction * 100;
    this.phaseName = this.astronomy.phaseName(illumination.phase);
    this.currentIcon = this.moonIcon(illumination.phase);
    const today = this.localDateParts(this.moment);
    this.todayMoon = this.astronomy.moonForCalendarDate(today.year, today.month, today.day, this.location);
  }

  private rebuildCalendars(): void {
    this.monthCalendar = this.buildMonth(this.viewYear, this.viewMonth);
    this.yearCalendar = this.mode === 'year' ? this.buildYear(this.viewYear) : [];
  }

  private buildYear(year: number): MoonMonth[] {
    return Array.from({ length: 12 }, (_, month) => this.buildMonth(year, month));
  }

  private buildMonth(year: number, month: number): MoonMonth {
    const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const offset = (firstDay + 6) % 7; // Monday = 0
    const days = Array.from({ length: count }, (_, index) => this.buildDay(year, month, index + 1));
    return { month, name: this.monthNames[month], offset, days };
  }

  private buildDay(year: number, month: number, day: number): MoonDay {
    // Noon UTC is sufficient for a stable daily phase thumbnail; precise rise/set
    // and illumination are recalculated at local noon when the user selects it.
    const sample = new Date(Date.UTC(year, month, day, 12));
    const illumination = SunCalc.getMoonIllumination(sample);
    const phase = illumination.phase;
    const key = this.key(year, month, day);
    return {
      year, month, day, key, phase,
      illumination: illumination.fraction,
      name: this.astronomy.phaseName(phase),
      icon: this.moonIcon(phase),
      today: key === this.todayKey,
      major: this.isMajorPhase(phase)
    };
  }

  private selectDate(year: number, month: number, day: number): void {
    const moon: MoonData = this.astronomy.moonForCalendarDate(year, month, day, this.location);
    const base = this.buildDay(year, month, day);
    const localNoon = new Date(Date.UTC(year, month, day, 12));
    this.selectedDay = {
      ...base,
      phase: moon.phase,
      illumination: moon.illumination,
      name: this.astronomy.phaseName(moon.phase),
      icon: this.moonIcon(moon.phase),
      rise: moon.rise,
      set: moon.set,
      dateLabel: new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(localNoon)
    };
  }

  private localDateParts(date: Date): { year: number; month: number; day: number } {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: this.location.timezone, year: 'numeric', month: '2-digit', day: '2-digit'
      }).formatToParts(date);
      const read = (type: 'year' | 'month' | 'day'): number => Number(parts.find(part => part.type === type)?.value ?? 0);
      return { year: read('year'), month: read('month') - 1, day: read('day') };
    } catch {
      return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() };
    }
  }

  private key(year: number, month: number, day: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private isMajorPhase(phase: number): boolean {
    const quarter = Math.round(phase * 4) / 4;
    const distance = Math.min(Math.abs(phase - quarter), Math.abs(phase - 1), Math.abs(phase));
    return distance < .025;
  }

  private moonIcon(phase: number): string {
    return ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'][Math.round((phase % 1) * 8) % 8];
  }
}
