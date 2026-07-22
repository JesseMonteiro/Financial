export const CATEGORY_COLORS = {
  'Alimentação': '#f97316',
  'Supermercado': '#fb923c',
  'Restaurantes': '#ea580c',
  'Transporte': '#0ea5e9',
  'Uber/Táxi': '#38bdf8',
  'Combustível': '#0284c7',
  'Moradia': '#8b5cf6',
  'Aluguel': '#a855f7',
  'Contas de Luz/Água': '#c084fc',
  'Saúde': '#10b981',
  'Farmácia': '#34d399',
  'Educação': '#eab308',
  'Lazer': '#ec4899',
  'Viagem': '#f472b6',
  'Vestuário': '#14b8a6',
  'Serviços': '#3b82f6',
  'Assinaturas/Streaming': '#60a5fa',
  'Investimentos': '#84cc16',
  'Rendimento': '#22c55e',
  'Salário': '#16a34a',
  'Outros': '#64748b',
};

export function getCategoryColor(categoryName) {
  if (!categoryName) return CATEGORY_COLORS['Outros'];
  return CATEGORY_COLORS[categoryName] || '#6366f1';
}
