import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  TrendingUp,
  CreditCard,
  Landmark,
  PieChart,
  Target,
  BarChart3,
  Plug,
  Settings,
  HandCoins,
  PlusCircle,
  Activity,
  MoreHorizontal,
} from 'lucide-react';

export const navItems = [
  { label: 'Visão Geral', shortLabel: 'Início', path: '/', icon: LayoutDashboard },
  { label: 'Contas & Saldos', shortLabel: 'Contas', path: '/accounts', icon: Wallet },
  { label: 'Transações', shortLabel: 'Transações', path: '/transactions', icon: ArrowLeftRight },
  { label: 'Investimentos', shortLabel: 'Investir', path: '/investments', icon: TrendingUp },
  { label: 'Cartões de Crédito', shortLabel: 'Cartões', path: '/credit-cards', icon: CreditCard },
  { label: 'Empréstimos', shortLabel: 'Empréstimos', path: '/loans', icon: Landmark },
  { label: 'Orçamento', shortLabel: 'Orçamento', path: '/budget', icon: PieChart },
  { label: 'Valores a Receber', shortLabel: 'Receber', path: '/receivables', icon: HandCoins },
  { label: 'Momento Financeiro', shortLabel: 'Momento', path: '/financial-moment', icon: Activity },
  { label: 'Despesas Manuais', shortLabel: 'Despesas', path: '/manual-expenses', icon: PlusCircle },
  { label: 'Metas', shortLabel: 'Metas', path: '/goals', icon: Target },
  { label: 'Relatórios', shortLabel: 'Relatórios', path: '/reports', icon: BarChart3 },
  { label: 'Conexões Bancárias', shortLabel: 'Conectar', path: '/connect', icon: Plug },
  { label: 'Configurações', shortLabel: 'Ajustes', path: '/settings', icon: Settings },
];

/** Primary tabs shown in the liquid glass bottom bar (paths). */
export const mobileTabPaths = ['/', '/transactions', '/credit-cards', '/financial-moment'];

export const mobilePrimaryTabs = [
  ...mobileTabPaths.map((path) => navItems.find((item) => item.path === path)).filter(Boolean),
  { label: 'Mais', shortLabel: 'Mais', path: '__more__', icon: MoreHorizontal, isMore: true },
];
