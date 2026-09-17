import { AfterViewInit, Component, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { DecimalPipe, NgStyle } from '@angular/common';
import * as L from 'leaflet';
import * as SunCalc from 'suncalc';
import { Location } from '../../models/astronomy.models';

@Component({ selector: 'app-solar-map', standalone: true, imports: [DecimalPipe, NgStyle], templateUrl: './solar-map.component.html', styleUrl: './solar-map.component.css' })
export class SolarMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) location!: Location;
  @Input({ required: true }) moment!: Date;
  @ViewChild('map') mapElement!: ElementRef<HTMLDivElement>;
  protected altitude = 0;
  protected bearing = 0;
  protected localClock = '';
  private map?: L.Map;
  private marker?: L.CircleMarker;
  private nightLayers: L.Layer[] = [];

  ngAfterViewInit(): void {
    this.map = L.map(this.mapElement.nativeElement, { zoomControl: false, attributionControl: true, worldCopyJump: true }).setView([18, 0], 2);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap contributors' }).addTo(this.map);
    this.addTimezoneGrid();
    this.updateMap();
  }

  ngOnChanges(changes: SimpleChanges): void { if (this.map && (changes['location'] || changes['moment'])) this.updateMap(); }
  ngOnDestroy(): void { this.map?.remove(); }
  protected focusLocation(): void { this.map?.flyTo([this.location.latitude, this.location.longitude], 6, { animate: true, duration: .8 }); }

  protected compassPosition(): Record<string, string> {
    const radius = 30 + (Math.max(0, Math.min(75, this.altitude)) / 75) * 29;
    const radians = (this.bearing - 90) * Math.PI / 180;
    return { left: `${50 + Math.cos(radians) * radius}%`, top: `${50 + Math.sin(radians) * radius}%` };
  }

  private updateMap(): void {
    const point: L.LatLngExpression = [this.location.latitude, this.location.longitude];
    if (this.marker) this.marker.setLatLng(point);
    else this.marker = L.circleMarker(point, { radius: 8, color: '#fff8e9', weight: 2, fillColor: '#f6b85f', fillOpacity: 1 }).addTo(this.map!);
    this.marker.bindTooltip(`<b>${this.location.city}</b><br>${this.location.latitude.toFixed(2)}°, ${this.location.longitude.toFixed(2)}°`, { direction: 'top', offset: [0, -8] });
    const position = SunCalc.getPosition(this.moment, this.location.latitude, this.location.longitude);
    this.altitude = position.altitude * 180 / Math.PI;
    this.bearing = (position.azimuth * 180 / Math.PI + 180 + 360) % 360;
    this.localClock = new Intl.DateTimeFormat('fr-FR', { timeZone: this.location.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(this.moment);
    this.drawNightArea();
  }

  private addTimezoneGrid(): void {
    if (!this.map) return;
    const group = L.layerGroup().addTo(this.map);
    for (let longitude = -180; longitude <= 180; longitude += 15) {
      L.polyline([[-85, longitude], [85, longitude]], { color: '#e4ecf6', weight: 1, opacity: .17, interactive: false }).addTo(group);
      if (longitude % 30 === 0 && longitude < 180) {
        const offset = longitude / 15;
        L.marker([0, longitude], { interactive: false, icon: L.divIcon({ className: 'timezone-tag', html: `UTC${offset > 0 ? '+' : ''}${offset}`, iconSize: [42, 16], iconAnchor: [21, 8] }) }).addTo(group);
      }
    }
  }

  private drawNightArea(): void {
    if (!this.map) return;
    this.nightLayers.forEach(layer => layer.remove());
    this.nightLayers = [];
    const solar = this.solarCoordinates(this.moment);
    const nightStyle: L.PathOptions = { color: '#0a1028', weight: 0, fillColor: '#0a1028', fillOpacity: .62, interactive: false };
    if (Math.abs(solar.declination) < .5) {
      const dawn = this.wrapLongitude(solar.longitude - 90);
      const dusk = this.wrapLongitude(solar.longitude + 90);
      const ranges: [number, number][] = dawn < dusk ? [[-180, dawn], [dusk, 180]] : [[dusk, dawn]];
      this.nightLayers = ranges.map(([west, east]) => L.rectangle(L.latLngBounds([-89.9, west], [89.9, east]), nightStyle).addTo(this.map!));
      return;
    }
    const pole = solar.declination > 0 ? -89.9 : 89.9;
    const terminator: L.LatLngExpression[] = [];
    for (let longitude = 180; longitude >= -180; longitude -= 2) {
      const hourAngle = (longitude - solar.longitude) * Math.PI / 180;
      const latitude = Math.atan(-Math.cos(hourAngle) / Math.tan(solar.declination * Math.PI / 180)) * 180 / Math.PI;
      terminator.push([Math.max(-89.9, Math.min(89.9, latitude)), longitude]);
    }
    this.nightLayers = [L.polygon([[pole, -180], [pole, 180], ...terminator], nightStyle).addTo(this.map)];
  }

  private solarCoordinates(date: Date): { declination: number; longitude: number } {
    const yearStart = Date.UTC(date.getUTCFullYear(), 0, 0);
    const day = (date.getTime() - yearStart) / 86_400_000;
    const minutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
    const gamma = 2 * Math.PI / 365 * (day - 1 + (minutes / 60 - 12) / 24);
    const declination = (.006918 - .399912 * Math.cos(gamma) + .070257 * Math.sin(gamma) - .006758 * Math.cos(2 * gamma) + .000907 * Math.sin(2 * gamma) - .002697 * Math.cos(3 * gamma) + .00148 * Math.sin(3 * gamma)) * 180 / Math.PI;
    const equation = 229.18 * (.000075 + .001868 * Math.cos(gamma) - .032077 * Math.sin(gamma) - .014615 * Math.cos(2 * gamma) - .040849 * Math.sin(2 * gamma));
    return { declination, longitude: this.wrapLongitude((720 - minutes - equation) / 4) };
  }

  private wrapLongitude(longitude: number): number { return ((longitude + 540) % 360) - 180; }
}
