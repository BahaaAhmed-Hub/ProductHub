import {
  Network, Plus, PlusCircle, Archive, Newspaper, ClipboardList, Paperclip,
  Sparkles, KeyRound, Zap, Bug, Shapes, Check, ListChecks, X, Wrench,
  LayoutDashboard, FileText, AlertCircle, ChevronDown, Puzzle, List, Users,
  CircleHelp, Inbox, LineChart, Flame, LogOut, Map, Mic, Bell, Clock,
  FlaskConical, Search, Repeat, ScrollText, SlidersHorizontal, TrendingUp,
  TrendingDown, SquareKanban, Columns3, Circle, Eye, EyeOff, ArrowUpRight, Copy,
  Link2, Rocket, Building2, HourglassIcon, CircleCheck, CreditCard,
  type LucideIcon,
} from 'lucide-react';

/**
 * Semantic icon map. Call sites pass a stable semantic name (originally the
 * Material Symbols glyph name from the design package); we render the matching
 * lucide SVG so icons never depend on a runtime icon font / CDN.
 */
const MAP: Record<string, LucideIcon> = {
  account_tree: Network,
  add: Plus,
  add_circle: PlusCircle,
  archive: Archive,
  article: Newspaper,
  assignment_ind: ClipboardList,
  attach_file: Paperclip,
  auto_awesome: Sparkles,
  badge: KeyRound,
  bolt: Zap,
  bug_report: Bug,
  category: Shapes,
  check: Check,
  checklist: ListChecks,
  close: X,
  construction: Wrench,
  dashboard: LayoutDashboard,
  description: FileText,
  error: AlertCircle,
  expand_more: ChevronDown,
  extension: Puzzle,
  format_list_bulleted: List,
  groups: Users,
  help: CircleHelp,
  inbox: Inbox,
  insights: LineChart,
  local_fire_department: Flame,
  logout: LogOut,
  map: Map,
  mic: Mic,
  move_to_inbox: Inbox,
  north_east: ArrowUpRight,
  notifications: Bell,
  schedule: Clock,
  science: FlaskConical,
  search: Search,
  sprint: Repeat,
  summarize: ScrollText,
  tune: SlidersHorizontal,
  visibility: Eye,
  visibility_off: EyeOff,
  trending_up: TrendingUp,
  trending_down: TrendingDown,
  view_kanban: SquareKanban,
  view_week: Columns3,
  content_copy: Copy,
  key: KeyRound,
  link: Link2,
  rocket_launch: Rocket,
  apartment: Building2,
  hourglass_top: HourglassIcon,
  check_circle: CircleCheck,
  credit_card: CreditCard,
};

interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 20, className }: IconProps) {
  const Cmp = MAP[name] ?? Circle;
  return <Cmp size={size} className={className} strokeWidth={2} aria-hidden />;
}
