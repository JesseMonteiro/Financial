export const MOCK_ACCOUNTS = [
  {
    id: 'acc_101',
    name: 'Conta Corrente Principal',
    type: 'BANK',
    subtype: 'CHECKING_ACCOUNT',
    balance: 4850.75,
    currencyCode: 'BRL',
    number: '0001-48291',
    bankData: {
      institutionName: 'Itaú Unibanco',
      primaryColor: '#ec7000'
    }
  },
  {
    id: 'acc_102',
    name: 'Reserva de Emergência',
    type: 'BANK',
    subtype: 'SAVINGS_ACCOUNT',
    balance: 25400.00,
    currencyCode: 'BRL',
    number: '0001-99812',
    bankData: {
      institutionName: 'Nubank',
      primaryColor: '#820ad1'
    }
  },
  {
    id: 'acc_103',
    name: 'Cartão Ultravioleta',
    type: 'CREDIT',
    subtype: 'CREDIT_CARD',
    balance: -3420.50,
    currencyCode: 'BRL',
    number: '8821',
    creditData: {
      creditLimit: 15000.00,
      availableCreditLimit: 11579.50,
      balanceDueDate: '2026-08-10T00:00:00Z',
      minimumPayment: 342.05,
      institutionName: 'Nubank'
    }
  },
  {
    id: 'acc_104',
    name: 'Cartão Itaú Personnalité',
    type: 'CREDIT',
    subtype: 'CREDIT_CARD',
    balance: -1280.00,
    currencyCode: 'BRL',
    number: '4410',
    creditData: {
      creditLimit: 25000.00,
      availableCreditLimit: 23720.00,
      balanceDueDate: '2026-08-15T00:00:00Z',
      minimumPayment: 128.00,
      institutionName: 'Itaú Unibanco'
    }
  }
];

export const MOCK_TRANSACTIONS = [
  {
    id: 'tx_01',
    accountId: 'acc_101',
    description: 'Carrefour Supermercado',
    amount: -342.80,
    date: '2026-07-21T10:15:00Z',
    category: 'Alimentação',
    type: 'DEBIT',
    status: 'POSTED',
    merchant: { name: 'Carrefour' }
  },
  {
    id: 'tx_02',
    accountId: 'acc_101',
    description: 'Pagamento de Salário Tech Corp',
    amount: 12500.00,
    date: '2026-07-20T08:00:00Z',
    category: 'Salário',
    type: 'CREDIT_INCOME',
    status: 'POSTED',
    merchant: { name: 'Tech Corp S.A.' }
  },
  {
    id: 'tx_03',
    accountId: 'acc_103',
    description: 'Uber * Viagem Urbana',
    amount: -34.90,
    date: '2026-07-19T21:40:00Z',
    category: 'Transporte',
    type: 'DEBIT',
    status: 'POSTED',
    merchant: { name: 'Uber' }
  },
  {
    id: 'tx_04',
    accountId: 'acc_103',
    description: 'Netflix Assinatura Mensal',
    amount: -55.90,
    date: '2026-07-18T14:20:00Z',
    category: 'Lazer',
    type: 'DEBIT',
    status: 'POSTED',
    merchant: { name: 'Netflix' }
  },
  {
    id: 'tx_05',
    accountId: 'acc_101',
    description: 'Posto Shell Combustível',
    amount: -220.00,
    date: '2026-07-17T18:10:00Z',
    category: 'Transporte',
    type: 'DEBIT',
    status: 'POSTED',
    merchant: { name: 'Shell' }
  },
  {
    id: 'tx_06',
    accountId: 'acc_101',
    description: 'Drogaria São Paulo',
    amount: -89.40,
    date: '2026-07-16T11:05:00Z',
    category: 'Saúde',
    type: 'DEBIT',
    status: 'POSTED',
    merchant: { name: 'Drogaria São Paulo' }
  },
  {
    id: 'tx_07',
    accountId: 'acc_101',
    description: 'Restaurante OutBack',
    amount: -185.00,
    date: '2026-07-15T20:30:00Z',
    category: 'Alimentação',
    type: 'DEBIT',
    status: 'POSTED',
    merchant: { name: 'OutBack Steakhouse' }
  },
  {
    id: 'tx_08',
    accountId: 'acc_102',
    description: 'Rendimento de Poupança / CDB',
    amount: 245.30,
    date: '2026-07-01T00:00:00Z',
    category: 'Rendimento',
    type: 'CREDIT_INCOME',
    status: 'POSTED',
    merchant: { name: 'Nubank Financeira' }
  }
];

export const MOCK_INVESTMENTS = [
  {
    id: 'inv_01',
    name: 'CDB 100% CDI Liquidez Diária',
    code: 'CDB-NUBANK',
    type: 'FIXED_INCOME',
    subtype: 'CDB',
    balance: 15400.00,
    amount: 15400.00,
    quantity: 1,
    value: 15400.00,
    lastTwelveMonthsRate: 10.75,
    annualRate: 10.50
  },
  {
    id: 'inv_02',
    name: 'Tesouro Selic 2029',
    code: 'NFT-SELIC-29',
    type: 'FIXED_INCOME',
    subtype: 'TREASURY',
    balance: 28500.00,
    amount: 28500.00,
    quantity: 2.15,
    value: 13255.81,
    lastTwelveMonthsRate: 11.10,
    annualRate: 10.75
  },
  {
    id: 'inv_03',
    name: 'IVVB11 — iShares S&P 500 ETF',
    code: 'IVVB11',
    type: 'ETF',
    subtype: 'INDEX',
    balance: 14200.00,
    amount: 14200.00,
    quantity: 42,
    value: 338.09,
    lastTwelveMonthsRate: 18.50,
    annualRate: 16.20
  },
  {
    id: 'inv_04',
    name: 'KNCR11 — Kinea Rendimentos Imobiliários',
    code: 'KNCR11',
    type: 'EQUITY',
    subtype: 'REAL_ESTATE_FUND',
    balance: 8900.00,
    amount: 8900.00,
    quantity: 85,
    value: 104.70,
    lastTwelveMonthsRate: 12.30,
    annualRate: 11.80
  }
];

export const MOCK_LOANS = [
  {
    id: 'loan_01',
    name: 'Financiamento Imobiliário Caixa',
    type: 'MORTGAGE',
    balance: 185000.00,
    amount: 220000.00,
    monthlyInstallment: 1950.00,
    totalInstallments: 360,
    paidInstallments: 48,
    interestRate: 8.5,
    startDate: '2022-07-15T00:00:00Z'
  }
];

export const MOCK_BUDGETS = [
  { category: 'Alimentação', limit: 1500, spent: 527.80 },
  { category: 'Transporte', limit: 800, spent: 254.90 },
  { category: 'Moradia', limit: 3000, spent: 2850.00 },
  { category: 'Saúde', limit: 600, spent: 89.40 },
  { category: 'Lazer', limit: 500, spent: 240.90 }
];

export const MOCK_GOALS = [
  {
    id: 'g_01',
    title: 'Viagem Europa 2027',
    targetAmount: 20000,
    currentAmount: 12500,
    deadline: '2027-06-30',
    color: '#3b82f6',
    icon: 'Plane'
  },
  {
    id: 'g_02',
    title: 'Reserva 6 Meses',
    targetAmount: 30000,
    currentAmount: 25400,
    deadline: '2026-12-31',
    color: '#10b981',
    icon: 'ShieldCheck'
  }
];
