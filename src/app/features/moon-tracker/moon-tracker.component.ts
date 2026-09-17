import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { DatePipe, DecimalPipe, NgStyle } from '@angular/common';
import * as SunCalc from 'suncalc';
import { Location } from '../../models/astronomy.models';
import { AstronomyService } from '../../core/astronomy.service';

interface MoonDay { day: number; phase: number; name: string; icon: string; today: boolean; }

@Component({ selector: 'app-moon-tracker', standalone: true, imports: [DatePipe, DecimalPipe, NgStyle], templateUrl: './moon-tracker.component.html', styleUrl: './moon-tracker.component.css' })
export class MoonTrackerComponent implements OnChanges {
  @Input({ required: true }) location!: Location;
  @Input({ required: true }) moment!: Date;
  protected altitude = 0;
  protected bearing = 0;
  protected illumination = 0;
  protected phase = 0;
  protected phaseName = '';
  protected calendar: MoonDay[] = [];
  protected monthName = '';

  constructor(protected readonly astronomy: AstronomyService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['location'] || changes['moment']) this.refresh();
  }

  protected compassPosition(): Record<string, string> {
    const radius = 28 + (Math.max(0, Math.min(75, this.altitude)) / 75) * 27;
    const radians = (this.bearing - 90) * Math.PI / 180;
    return { left: `${50 + Math.cos(radians) * radius}%`, top: `${50 + Math.sin(radians) * radius}%` };
  }

  private refresh(): void {
    const position = SunCalc.getMoonPosition(this.moment, this.location.latitude, this.location.longitude);
    const illumination = SunCalc.getMoonIllumination(this.moment);
    this.altitude = position.altitude * 180 / Math.PI;
    this.bearing = (position.azimuth * 180 / Math.PI + 180 + 360) % 360;
    this.illumination = illumination.fraction * 100;
    this.phase = illumination.phase;
    this.phaseName = this.astronomy.phaseName(illumination.phase);
    this.monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(this.moment);
    this.calendar = this.monthDays(this.moment);
  }

  private monthDays(date: Date): MoonDay[] {
    const year = date.getFullYear();
    const month = date.getMonth();
    const numberOfDays = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: numberOfDays }, (_, index) => {
      const day = index + 1;
      const sample = new Date(year, month, day, 12);
      const phase = SunCalc.getMoonIllumination(sample).phase;
      return { day, phase, name: this.astronomy.phaseName(phase), icon: this.moonIcon(phase), today: day === date.getDate() };
    });
  }

  private moonIcon(phase: number): string {
    return ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'][Math.round((phase % 1) * 8) % 8];
  }
}
