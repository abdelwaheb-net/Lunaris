import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AstronomyService } from './core/astronomy.service';
import { Location } from './models/astronomy.models';
import { SolarMapComponent } from './features/solar-map/solar-map.component';
import { MoonTrackerComponent } from './features/moon-tracker/moon-tracker.component';

type City = Location & { label: string };
type LookupStatus = 'idle' | 'loading' | 'error';

interface GeocodingResult {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  timezone?: string;
}

interface GeocodingResponse { results?: GeocodingResult[]; }

@Component({
  selector: 'app-root', standalone: true, imports: [FormsModule, DatePipe, DecimalPipe, NgClass, SolarMapComponent, MoonTrackerComponent],
  templateUrl: './app.component.html', styleUrl: './app.component.css', changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  private readonly astronomy = inject(AstronomyService);
  readonly now = signal(new Date());
  readonly query = signal('');
  readonly showPlaces = signal(false);
  readonly locationResults = signal<City[]>([]);
  readonly lookupStatus = signal<LookupStatus>('idle');
  readonly prayerMode = signal(false);
  readonly selected = signal<Location>(DEFAULT_LOCATION);
  readonly sun = computed(() => this.astronomy.sun(this.now(), this.selected()));
  readonly moon = computed(() => this.astronomy.moon(this.now(), this.selected()));
  readonly prayers = computed(() => this.astronomy.prayerTimes(this.now(), this.selected()));
  readonly phaseName = computed(() => this.astronomy.phaseName(this.moon().phase));
  readonly daylight = computed(() => Math.round(this.sun().dayLength / 60000));
  readonly isNight = computed(() => {
    const now = this.now().getTime();
    const { sunrise, sunset } = this.sun();
    return now < sunrise.getTime() || now >= sunset.getTime();
  });
  readonly themeLabel = computed(() => this.isNight() ? 'Mode nuit' : 'Mode jour');
  readonly sunProgress = computed(() => {
    const { sunrise, sunset } = this.sun(); const value = (this.now().getTime() - sunrise.getTime()) / (sunset.getTime() - sunrise.getTime());
    return Math.max(0, Math.min(100, value * 100));
  });
  readonly moonStyle = computed(() => ({ '--phase': `${this.moon().phase * 360}deg` }));
  readonly dateLabel = computed(() => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(this.now()));
  private searchTimer?: number;
  private searchAbort?: AbortController;

  constructor() {
    effect(onCleanup => { const timer = window.setInterval(() => this.now.set(new Date()), 60_000); onCleanup(() => clearInterval(timer)); });
  }

  pick(city: City): void { this.selected.set(city); this.query.set(''); this.locationResults.set([]); this.lookupStatus.set('idle'); this.showPlaces.set(false); }
  setView(id: string): void { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  formatDuration(total: number): string { return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')} min`; }

  searchCity(value: string): void {
    this.query.set(value);
    window.clearTimeout(this.searchTimer);
    this.searchAbort?.abort();
    if (value.trim().length < 2) { this.locationResults.set([]); this.lookupStatus.set('idle'); return; }
    this.lookupStatus.set('loading');
    this.searchTimer = window.setTimeout(() => void this.lookupCity(value), 320);
  }

  private async lookupCity(query: string): Promise<void> {
    this.searchAbort = new AbortController();
    try {
      const parameters = new URLSearchParams({ name: query.trim(), count: '7', language: 'fr', format: 'json' });
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${parameters}`, { signal: this.searchAbort.signal });
      if (!response.ok) throw new Error('Geocoding service unavailable');
      const data = await response.json() as GeocodingResponse;
      this.locationResults.set((data.results ?? []).map(place => ({
        label: `${place.name}${place.admin1 ? `, ${place.admin1}` : ''}${place.country ? `, ${place.country}` : ''}`,
        city: place.name,
        country: place.country ?? place.admin1 ?? 'Localisation inconnue',
        latitude: place.latitude,
        longitude: place.longitude,
        timezone: place.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
      })));
      this.lookupStatus.set('idle');
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      this.locationResults.set([]);
      this.lookupStatus.set('error');
    }
  }
}

const DEFAULT_LOCATION: Location = { city: 'Paris', country: 'France', latitude: 48.8566, longitude: 2.3522, timezone: 'Europe/Paris' };
