import type { WidgetSpec, WidgetType } from './types';

const VALID_TYPES = new Set<WidgetType>([
  'comparison', 'checklist', 'ranking', 'swot', 'risk_matrix',
]);

export function validateWidgetSpec(raw: unknown): WidgetSpec | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  const type = obj.type as WidgetType;
  if (!VALID_TYPES.has(type)) return null;

  const id = (typeof obj.id === 'string' && obj.id) ? obj.id : `widget_${Date.now()}`;
  const title = typeof obj.title === 'string' ? obj.title : '';
  const description = typeof obj.description === 'string' ? obj.description : undefined;

  const spec: WidgetSpec = { id, type, title, description };

  switch (type) {
    case 'comparison':
      if (!Array.isArray(obj.options) || obj.options.length === 0) return null;
      spec.options = obj.options as WidgetSpec['options'];
      break;
    case 'checklist':
    case 'ranking':
      if (!Array.isArray(obj.items) || obj.items.length === 0) return null;
      spec.items = obj.items as WidgetSpec['items'];
      break;
    case 'swot':
      if (!obj.swot || typeof obj.swot !== 'object') return null;
      spec.swot = obj.swot as WidgetSpec['swot'];
      break;
    case 'risk_matrix':
      if (!Array.isArray(obj.risks) || obj.risks.length === 0) return null;
      spec.risks = obj.risks as WidgetSpec['risks'];
      break;
    default:
      return null;
  }

  return spec;
}
