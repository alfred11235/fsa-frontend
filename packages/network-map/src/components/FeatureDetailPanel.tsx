import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronRight, ExternalLink, Copy, Image, Clock, Table2, MapPin } from 'lucide-react';
import type { MapFeature } from '../types/map';
import type {
  DetailPanelConfig,
  DetailSection,
  AttributesSectionConfig,
  MediaSectionConfig,
  TableSectionConfig,
  TimelineSectionConfig,
  RelatedElementsConfig,
  MediaItem,
} from '../types/layers';
import { apiClient } from '@fsa/shared-api';

interface FeatureDetailPanelProps {
  feature: MapFeature;
  config: DetailPanelConfig;
  onClose: () => void;
}

function interpolate(template: string, props: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(props[key] ?? ''));
}

// ─── Section renderers ───────────────────────────────────

function AttributesSection({ config, props }: { config: AttributesSectionConfig; props: Record<string, unknown> }) {
  const cols = config.columns ?? 1;
  return (
    <div className={`grid gap-x-4 gap-y-2 ${cols === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {config.fields.map((field) => {
        if (field.visible === false) return null;
        if (typeof field.visible === 'string' && !props[field.visible]) return null;
        const value = props[field.property];
        return (
          <div key={field.property} className="flex flex-col">
            <span className="text-xs text-gray-400">{field.label}</span>
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-800">{formatDetailValue(field.format, value, field.formatOptions)}</span>
              {field.copyable && value != null && (
                <button
                  onClick={() => navigator.clipboard.writeText(String(value))}
                  className="text-gray-400 hover:text-gray-600"
                  title="Copy"
                >
                  <Copy size={12} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MediaSection({ config, featureId }: { config: MediaSectionConfig; featureId: string | number }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    if (config.source.type === 'endpoint') {
      const url = config.source.url.replace('{id}', String(featureId));
      apiClient.get(url).then((res) => setItems(res.data)).catch(() => {});
    }
  }, [config.source, featureId]);

  if (items.length === 0) {
    return <p className="text-xs text-gray-400">No media available</p>;
  }

  const thumbW = config.thumbnailSize?.width ?? 80;
  const thumbH = config.thumbnailSize?.height ?? 80;

  return (
    <>
      <div className={`flex flex-wrap gap-2 ${config.display === 'list' ? 'flex-col' : ''}`}>
        {items.slice(0, config.maxItems ?? 20).map((item, idx) => (
          <button
            key={item.id}
            onClick={() => config.lightbox !== false && setLightboxIdx(idx)}
            className="overflow-hidden rounded-md border border-gray-200 hover:ring-2 hover:ring-blue-300"
            title={item.title ?? item.type}
          >
            {item.type === 'image' ? (
              <img
                src={item.thumbnailUrl ?? item.url}
                alt={item.title ?? ''}
                style={{ width: thumbW, height: thumbH, objectFit: 'cover' }}
              />
            ) : (
              <div
                className="flex items-center justify-center bg-gray-100 text-xs text-gray-500"
                style={{ width: thumbW, height: thumbH }}
              >
                <Image size={20} />
                <span className="ml-1">{item.type}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {lightboxIdx !== null && items[lightboxIdx] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setLightboxIdx(null)}
        >
          <img
            src={items[lightboxIdx].url}
            alt={items[lightboxIdx].title ?? ''}
            className="max-h-[80vh] max-w-[80vw] rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

function TableSection({ config, featureId }: { config: TableSectionConfig; featureId: string | number }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    const url = config.endpoint.replace('{id}', String(featureId));
    apiClient.get(url).then((res) => setRows(res.data)).catch(() => {});
  }, [config.endpoint, featureId]);

  return (
    <div className="max-h-48 overflow-auto rounded-md border border-gray-200">
      <table className="w-full text-xs">
        <thead className="bg-gray-50">
          <tr>
            {config.columns.map((col) => (
              <th key={col.field} className="px-2 py-1.5 text-left font-medium text-gray-500">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, config.pageSize ?? 20).map((row, i) => (
            <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
              {config.columns.map((col) => (
                <td key={col.field} className="px-2 py-1.5 text-gray-700">
                  {String(row[col.field] ?? '')}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={config.columns.length} className="px-2 py-4 text-center text-gray-400">
                No records
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TimelineSection({ config, featureId }: { config: TimelineSectionConfig; featureId: string | number }) {
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    const url = config.endpoint.replace('{id}', String(featureId));
    apiClient.get(url).then((res) => setEvents(res.data)).catch(() => {});
  }, [config.endpoint, featureId]);

  return (
    <div className="space-y-3">
      {events.slice(0, config.maxItems ?? 10).map((evt, i) => (
        <div key={i} className="relative flex gap-3 pl-4">
          <div className="absolute left-0 top-1 h-2 w-2 rounded-full bg-blue-500" />
          {i < events.length - 1 && (
            <div className="absolute left-[3px] top-3 h-full w-0.5 bg-gray-200" />
          )}
          <div className="flex-1">
            <div className="text-xs text-gray-400">
              {new Date(String(evt[config.dateField])).toLocaleDateString()}
            </div>
            <div className="text-sm font-medium text-gray-800">
              {String(evt[config.titleField] ?? '')}
            </div>
            {config.descriptionField && evt[config.descriptionField] != null && (
              <div className="text-xs text-gray-500">{String(evt[config.descriptionField] ?? '')}</div>
            )}
          </div>
        </div>
      ))}
      {events.length === 0 && <p className="text-xs text-gray-400">No history</p>}
    </div>
  );
}

function RelatedElementsSection({
  config,
  featureId,
}: {
  config: RelatedElementsConfig;
  featureId: string | number;
}) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    const url = config.endpoint.replace('{id}', String(featureId));
    apiClient.get(url).then((res) => setItems(res.data)).catch(() => {});
  }, [config.endpoint, featureId]);

  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50">
          <MapPin size={12} className="text-gray-400" />
          <div className="flex-1">
            {config.fields.map((f) => (
              <span key={f.property} className="mr-2 text-xs text-gray-600">
                {String(item[f.property] ?? '')}
              </span>
            ))}
          </div>
        </div>
      ))}
      {items.length === 0 && <p className="text-xs text-gray-400">No related elements</p>}
    </div>
  );
}

// ─── Collapsible section wrapper ─────────────────────────

function SectionWrapper({
  section,
  children,
}: {
  section: DetailSection;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(section.defaultCollapsed ?? false);
  const isCollapsible = section.collapsible ?? true;
  const SectionIcon = getSectionIcon(section.type);

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => isCollapsible && setCollapsed(!collapsed)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
        disabled={!isCollapsible}
      >
        <SectionIcon size={14} className="text-gray-400" />
        {section.title}
        {isCollapsible && (
          <span className="ml-auto">
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </span>
        )}
      </button>
      {!collapsed && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

function getSectionIcon(type: DetailSection['type']): typeof Image {
  switch (type) {
    case 'media':
      return Image;
    case 'table':
      return Table2;
    case 'timeline':
      return Clock;
    case 'related-elements':
      return MapPin;
    default:
      return ExternalLink;
  }
}

// ─── Helper ──────────────────────────────────────────────

function formatDetailValue(format: string | undefined, value: unknown, opts?: Record<string, unknown>): string {
  if (value == null) return '—';
  switch (format) {
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value);
    case 'date':
      return new Date(String(value)).toLocaleDateString();
    case 'datetime':
      return new Date(String(value)).toLocaleString();
    case 'currency': {
      const currency = (opts?.currency as string) ?? 'BRL';
      return typeof value === 'number'
        ? value.toLocaleString('pt-BR', { style: 'currency', currency })
        : String(value);
    }
    case 'badge':
      return String(value);
    case 'coordinates': {
      if (Array.isArray(value)) return `${value[1]?.toFixed(6)}, ${value[0]?.toFixed(6)}`;
      return String(value);
    }
    case 'link':
      return String(value);
    default:
      return String(value);
  }
}

// ─── Main panel ──────────────────────────────────────────

export default function FeatureDetailPanel({ feature, config, onClose }: FeatureDetailPanelProps) {
  const props = feature.properties;
  const position = config.position ?? 'right';

  return (
    <div
      className={`absolute top-0 z-20 flex h-full flex-col border-gray-200 bg-white shadow-xl ${
        position === 'right' ? 'right-0 border-l' : 'left-0 border-r'
      }`}
      style={{ width: config.width ?? 380 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">
            {interpolate(config.title, props)}
          </h3>
          {config.subtitle && (
            <p className="text-xs text-gray-500">{interpolate(config.subtitle, props)}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X size={16} />
        </button>
      </div>

      {/* Badges */}
      {config.header?.badges && config.header.badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-gray-100 px-4 py-2">
          {config.header.badges.map((badge) => {
            const val = String(props[badge.property] ?? '');
            const bg = badge.colorMap?.[val] ?? '#e5e7eb';
            return (
              <span
                key={badge.property}
                className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: bg }}
              >
                {badge.label ? `${badge.label}: ${val}` : val}
              </span>
            );
          })}
        </div>
      )}

      {/* Action buttons */}
      {config.header?.actions && config.header.actions.length > 0 && (
        <div className="flex gap-2 border-b border-gray-100 px-4 py-2">
          {config.header.actions.map((action) => (
            <button
              key={action.label}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
              onClick={() => {
                if (action.action === 'navigate' && action.url) {
                  window.open(interpolate(action.url, props), '_blank');
                }
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Sections */}
      <div className="flex-1 overflow-y-auto">
        {config.sections.map((section, idx) => (
          <SectionWrapper key={idx} section={section}>
            {section.type === 'attributes' && (
              <AttributesSection config={section.config as AttributesSectionConfig} props={props} />
            )}
            {section.type === 'media' && (
              <MediaSection config={section.config as MediaSectionConfig} featureId={feature.id} />
            )}
            {section.type === 'table' && (
              <TableSection config={section.config as TableSectionConfig} featureId={feature.id} />
            )}
            {section.type === 'timeline' && (
              <TimelineSection config={section.config as TimelineSectionConfig} featureId={feature.id} />
            )}
            {section.type === 'related-elements' && (
              <RelatedElementsSection config={section.config as RelatedElementsConfig} featureId={feature.id} />
            )}
          </SectionWrapper>
        ))}
      </div>
    </div>
  );
}
