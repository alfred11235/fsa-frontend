import { useEffect, useRef } from 'react';
import { useMap } from '../context/MapContext';
import type { MapFeature } from '../types/map';
import type { PopupConfig, PopupField } from '../types/layers';

interface FeaturePopupProps {
  feature: MapFeature;
  config: PopupConfig;
}

function interpolate(template: string, props: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(props[key] ?? ''));
}

function formatValue(field: PopupField, value: unknown): string {
  if (value == null) return '—';
  switch (field.format) {
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value);
    case 'date':
      return new Date(String(value)).toLocaleDateString();
    case 'datetime':
      return new Date(String(value)).toLocaleString();
    case 'currency': {
      const currency = (field.formatOptions?.currency as string) ?? 'BRL';
      return typeof value === 'number'
        ? value.toLocaleString('pt-BR', { style: 'currency', currency })
        : String(value);
    }
    case 'badge':
      return String(value);
    case 'link':
      return String(value);
    default:
      return String(value);
  }
}

function buildBadgeHtml(field: PopupField, value: unknown): string {
  const text = String(value ?? '');
  const bgColor = field.colorMap?.[text] ?? '#e5e7eb';
  return `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;background:${bgColor};color:#fff">${text}</span>`;
}

function buildPopupHtml(feature: MapFeature, config: PopupConfig): string {
  const props = feature.properties;
  const lines: string[] = [];

  lines.push('<div style="font-family:system-ui,sans-serif;max-width:' + (config.maxWidth ?? 300) + 'px">');

  if (config.thumbnail) {
    const imgUrl = props[config.thumbnail.field];
    if (imgUrl) {
      const w = config.thumbnail.width ?? 40;
      const h = config.thumbnail.height ?? 40;
      lines.push(`<img src="${imgUrl}" style="width:${w}px;height:${h}px;border-radius:4px;float:left;margin-right:8px;object-fit:cover"/>`);
    }
  }

  if (config.title) {
    lines.push(`<div style="font-weight:600;font-size:14px;color:#1f2937">${interpolate(config.title, props)}</div>`);
  }
  if (config.subtitle) {
    lines.push(`<div style="font-size:12px;color:#6b7280;margin-bottom:6px">${interpolate(config.subtitle, props)}</div>`);
  }

  lines.push('<div style="clear:both"></div>');

  for (const field of config.fields) {
    const visible = field.visible;
    if (visible === false) continue;
    if (typeof visible === 'string' && !props[visible]) continue;

    const value = props[field.property];
    if (field.format === 'badge') {
      lines.push(`<div style="margin:2px 0"><span style="font-size:11px;color:#9ca3af">${field.label}:</span> ${buildBadgeHtml(field, value)}</div>`);
    } else {
      lines.push(`<div style="margin:2px 0"><span style="font-size:11px;color:#9ca3af">${field.label}:</span> <span style="font-size:13px;color:#374151">${formatValue(field, value)}</span></div>`);
    }
  }

  lines.push('</div>');
  return lines.join('');
}

export default function FeaturePopup({ feature, config }: FeaturePopupProps) {
  const { getAdapter } = useMap();
  const shownRef = useRef(false);

  useEffect(() => {
    const adapter = getAdapter();
    if (!adapter || !feature.geometry) return;

    const html = buildPopupHtml(feature, config);

    let lngLat: [number, number];
    const geom = feature.geometry;
    if (geom.type === 'Point') {
      lngLat = geom.coordinates as [number, number];
    } else if (geom.type === 'LineString') {
      const coords = geom.coordinates;
      const mid = coords[Math.floor(coords.length / 2)];
      lngLat = mid as [number, number];
    } else if (geom.type === 'Polygon') {
      const coords = geom.coordinates[0];
      const cx = coords.reduce((s, c) => s + c[0], 0) / coords.length;
      const cy = coords.reduce((s, c) => s + c[1], 0) / coords.length;
      lngLat = [cx, cy];
    } else {
      return;
    }

    adapter.showPopup(lngLat, html);
    shownRef.current = true;

    return () => {
      if (shownRef.current) {
        adapter.hidePopup();
        shownRef.current = false;
      }
    };
  }, [feature, config, getAdapter]);

  return null;
}
