import type { FeatureCollection } from 'geojson';
import type { MapLayerStyle } from './map';

// ─── Layer configuration ─────────────────────────────────

export interface LayerConfig {
  code: string;
  name: string;
  geometryType: 'point' | 'line' | 'polygon';
  source:
    | { type: 'mvt'; url: string }
    | { type: 'geojson'; url: string; refreshInterval?: number }
    | { type: 'geojson-static'; data: FeatureCollection };
  minZoom?: number;
  maxZoom?: number;
  style: Partial<MapLayerStyle>;
  symbologyRules?: SymbologyRule[];
  labelField?: string;
  labelMinZoom?: number;
  cluster?: ClusterConfig;
  heatmap?: HeatmapConfig;
  interactive?: boolean;
  popup?: PopupConfig;
  detailPanel?: DetailPanelConfig;
  visibleByDefault?: boolean;
  legendEnabled?: boolean;
  filters?: FilterConfig[];
  zOrder?: number;
}

export interface SymbologyRule {
  name: string;
  condition: Record<string, unknown>;
  style: Partial<MapLayerStyle>;
  sortOrder: number;
  isLegendVisible: boolean;
}

export interface ClusterConfig {
  enabled: boolean;
  maxZoom: number;
  radius?: number;
  serverSide?: boolean;
  colorSteps?: { count: number; color: string }[];
}

export interface HeatmapConfig {
  enabled: boolean;
  maxZoom: number;
  serverSide?: boolean;
  weight?: string;
  intensity?: number;
  radius?: number;
  colorRamp?: string[];
}

export interface FilterConfig {
  field: string;
  label: string;
  type: 'select' | 'multi_select' | 'range' | 'date_range' | 'boolean';
  options?: { value: string; label: string }[];
  defaultValue?: unknown;
}

// ─── Popup configuration ─────────────────────────────────

export interface PopupConfig {
  trigger: 'hover' | 'click' | 'both';
  title?: string;
  subtitle?: string;
  thumbnail?: {
    field: string;
    fallbackIcon?: string;
    width?: number;
    height?: number;
  };
  fields: PopupField[];
  maxWidth?: number;
}

export interface PopupField {
  property: string;
  label: string;
  format?: 'text' | 'number' | 'date' | 'datetime' | 'currency' | 'badge' | 'link';
  formatOptions?: Record<string, unknown>;
  colorMap?: Record<string, string>;
  visible?: boolean | string;
}

// ─── Detail panel configuration ──────────────────────────

export interface DetailPanelConfig {
  title: string;
  subtitle?: string;
  width?: number;
  position?: 'left' | 'right';
  header?: {
    image?: { field: string; fallbackIcon?: string };
    badges?: { property: string; label?: string; colorMap?: Record<string, string> }[];
    actions?: ActionButton[];
  };
  sections: DetailSection[];
  allowExtensionTabs?: boolean;
}

export interface ActionButton {
  label: string;
  icon?: string;
  action: 'navigate' | 'directions' | 'callback';
  url?: string;
  callbackKey?: string;
  coordsField?: string;
}

export interface DetailSection {
  title: string;
  icon?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  type: 'attributes' | 'media' | 'table' | 'custom' | 'related-elements' | 'timeline';
  config: AttributesSectionConfig | MediaSectionConfig | TableSectionConfig
        | RelatedElementsConfig | TimelineSectionConfig;
}

export interface AttributesSectionConfig {
  columns?: 1 | 2;
  fields: {
    property: string;
    label: string;
    format?: 'text' | 'number' | 'date' | 'datetime' | 'currency' | 'badge' | 'link' | 'coordinates';
    formatOptions?: Record<string, unknown>;
    copyable?: boolean;
    visible?: boolean | string;
  }[];
}

export interface MediaSectionConfig {
  source:
    | { type: 'property'; field: string }
    | { type: 'endpoint'; url: string };
  display: 'gallery' | 'carousel' | 'list';
  allowUpload?: boolean;
  uploadEndpoint?: string;
  maxItems?: number;
  accept?: string[];
  thumbnailSize?: { width: number; height: number };
  lightbox?: boolean;
}

export interface MediaItem {
  id: string;
  url: string;
  thumbnailUrl?: string;
  type: 'image' | 'video' | 'document' | 'audio';
  mimeType: string;
  title?: string;
  description?: string;
  createdAt?: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
}

export interface TableSectionConfig {
  endpoint: string;
  columns: {
    field: string;
    header: string;
    format?: string;
    sortable?: boolean;
    width?: number;
  }[];
  pageSize?: number;
  onRowClick?: 'navigate' | 'select' | 'popup';
}

export interface RelatedElementsConfig {
  endpoint: string;
  highlightOnMap?: boolean;
  highlightStyle?: Partial<MapLayerStyle>;
  fields: PopupField[];
}

export interface TimelineSectionConfig {
  endpoint: string;
  dateField: string;
  titleField: string;
  descriptionField?: string;
  iconField?: string;
  colorField?: string;
  maxItems?: number;
}
