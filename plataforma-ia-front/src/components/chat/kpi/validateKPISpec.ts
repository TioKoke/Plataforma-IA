import type { StandaloneKPISpec, KPICardSpec, KPIFormat } from './types';

const BRAND_COLORS = ['#0072B1', '#F4A261', '#00B4D8', '#2EC4B6', '#E76F51', '#A8DADC', '#264653', '#E9C46A'];
const VALID_FORMATS = new Set<KPIFormat>(['number', 'currency', 'percentage', 'compact']);
const VALID_DIRECTIONS = new Set(['up', 'down', 'flat']);

function normalizeCard(raw: Record<string, unknown>, index: number): KPICardSpec | null {
  const label = typeof raw.label === 'string' ? raw.label : '';
  if (!label) return null;

  const id = (typeof raw.id === 'string' && raw.id) ? raw.id : `kpi_card_${index}`;
  const value = (typeof raw.value === 'number' || typeof raw.value === 'string') ? raw.value : 0;
  const format = VALID_FORMATS.has(raw.format as KPIFormat) ? (raw.format as KPIFormat) : 'number';
  const unit = typeof raw.unit === 'string' ? raw.unit : undefined;
  const icon = typeof raw.icon === 'string' ? raw.icon : undefined;
  const color = typeof raw.color === 'string' ? raw.color : BRAND_COLORS[index % BRAND_COLORS.length];

  const card: KPICardSpec = { id, label, value, format, unit, icon, color };

  // Trend
  if (raw.trend && typeof raw.trend === 'object') {
    const t = raw.trend as Record<string, unknown>;
    const direction = VALID_DIRECTIONS.has(t.direction as string) ? (t.direction as 'up' | 'down' | 'flat') : 'flat';
    card.trend = {
      direction,
      value: typeof t.value === 'string' ? t.value : String(t.value ?? ''),
      label: typeof t.label === 'string' ? t.label : undefined,
    };
  }

  // Comparison
  if (raw.comparison && typeof raw.comparison === 'object') {
    const c = raw.comparison as Record<string, unknown>;
    if ((typeof c.value === 'number' || typeof c.value === 'string') && typeof c.label === 'string') {
      card.comparison = { value: c.value, label: c.label };
    }
  }

  // Sparkline
  if (Array.isArray(raw.sparkline) && raw.sparkline.length >= 2) {
    card.sparkline = raw.sparkline.filter((v): v is number => typeof v === 'number').slice(0, 20);
    if (card.sparkline.length < 2) card.sparkline = undefined;
  }

  // Target
  if (raw.target && typeof raw.target === 'object') {
    const tgt = raw.target as Record<string, unknown>;
    if (typeof tgt.value === 'number' && tgt.value > 0) {
      card.target = {
        value: tgt.value,
        label: typeof tgt.label === 'string' ? tgt.label : 'Meta',
      };
    }
  }

  return card;
}

export function validateKPISpec(raw: unknown): StandaloneKPISpec | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.cards) || obj.cards.length === 0) return null;

  const id = (typeof obj.id === 'string' && obj.id) ? obj.id : `kpi_${Date.now()}`;
  const title = typeof obj.title === 'string' ? obj.title : '';
  const description = typeof obj.description === 'string' ? obj.description : undefined;
  let columns = typeof obj.columns === 'number' ? obj.columns : 3;
  columns = Math.min(4, Math.max(1, Math.round(columns)));

  const cards: KPICardSpec[] = [];
  for (let i = 0; i < (obj.cards as unknown[]).length; i++) {
    const rawCard = (obj.cards as unknown[])[i];
    if (rawCard && typeof rawCard === 'object') {
      const card = normalizeCard(rawCard as Record<string, unknown>, i);
      if (card) cards.push(card);
    }
  }

  if (cards.length === 0) return null;

  // Auto-adjust columns: don't exceed card count
  columns = Math.min(columns, cards.length);

  return { id, title, description, columns, cards };
}
