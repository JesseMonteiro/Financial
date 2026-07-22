// Category translation dictionary for Pluggy API categories
const CATEGORY_TRANSLATIONS = {
  'Groceries': 'Supermercado & Alimentação',
  'Eating out': 'Restaurantes & Bares',
  'Food delivery': 'Delivery de Comida',
  'Cinema, theater and concerts': 'Cinema, Teatro & Shows',
  'Parking': 'Estacionamento',
  'Shopping': 'Compras & Lojas',
  'Services': 'Serviços',
  'Tickets': 'Ingressos & Eventos',
  'Digital services': 'Serviços Digitais',
  'Telecommunications': 'Telefone & Internet',
  'Car rental': 'Aluguel de Carros',
  'Automotive': 'Automóvel',
  'Gas stations': 'Postos de Combustível',
  'Vehicle maintenance': 'Manutenção Veicular',
  'Taxi and ride-hailing': 'Uber / Táxi / Transporte',
  'Healthcare': 'Saúde & Medicina',
  'Dentist': 'Odontologia',
  'Pharmacy': 'Farmácia & Drogaria',
  'Optometry': 'Ótica & Visão',
  'Gyms and fitness centers': 'Academias & Fitness',
  'Wellness and fitness': 'Bem-estar & Fitness',
  'Houseware': 'Utilidades Domésticas',
  'Rent': 'Aluguel',
  'Clothing': 'Vestuário & Roupas',
  'Gaming': 'Games & Entretenimento',
  'Transfers': 'Transferências',
  'Credit card payment': 'Pagamento de Fatura',
  'Bank fees': 'Tarifas Bancárias',
  'Salary': 'Salário & Renda',
  'Investments': 'Investimentos',
  'Other': 'Outros',
};

export function translateCategory(category) {
  if (!category) return 'Geral';
  return CATEGORY_TRANSLATIONS[category] || category;
}

export function allTranslations() {
  return CATEGORY_TRANSLATIONS;
}
