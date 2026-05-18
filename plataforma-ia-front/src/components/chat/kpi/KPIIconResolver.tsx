import type { LucideIcon } from 'lucide-react';
import {
  Activity, AlertTriangle, Award, BarChart3, Battery, Bell,
  Briefcase, Building2, Calculator, Calendar, CheckCircle, Clock,
  Cpu, Database, DollarSign, Download, Droplets, Factory,
  FileText, Flame, Globe, HardHat, Heart, Layers,
  Leaf, LineChart, Map, Megaphone, Minus, Mountain,
  Package, Percent, PieChart, Plug, Settings, Shield,
  Target, ThermometerSun, TrendingDown, TrendingUp, Truck, Upload,
  UserCheck, Users, Wrench, Zap,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Activity, AlertTriangle, Award, BarChart3, Battery, Bell,
  Briefcase, Building2, Calculator, Calendar, CheckCircle, Clock,
  Cpu, Database, DollarSign, Download, Droplets, Factory,
  FileText, Flame, Globe, HardHat, Heart, Layers,
  Leaf, LineChart, Map, Megaphone, Minus, Mountain,
  Package, Percent, PieChart, Plug, Settings, Shield,
  Target, ThermometerSun, TrendingDown, TrendingUp, Truck, Upload,
  UserCheck, Users, Wrench, Zap,
};

export function resolveIcon(name: string | undefined): LucideIcon {
  if (!name) return Activity;
  return ICON_MAP[name] ?? Activity;
}
