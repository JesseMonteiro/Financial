-- Migrate budget categories from PT-BR labels to Level 1 base keys

UPDATE public.budgets SET category = CASE category
  WHEN 'Alimentação' THEN 'Food and drinks'
  WHEN 'Supermercados' THEN 'Groceries'
  WHEN 'Habitação' THEN 'Housing'
  WHEN 'Transporte' THEN 'Transportation'
  WHEN 'Serviços' THEN 'Services'
  WHEN 'Compras' THEN 'Shopping'
  WHEN 'Saúde' THEN 'Healthcare'
  WHEN 'Educação' THEN 'Education'
  WHEN 'Lazer' THEN 'Leisure'
  WHEN 'Serviços digitais' THEN 'Digital services'
  WHEN 'Viagens' THEN 'Travel'
  WHEN 'Renda' THEN 'Income'
  WHEN 'Investimentos' THEN 'Investments'
  WHEN 'Transferências' THEN 'Transfers'
  WHEN 'Transferência entre mesma pessoa' THEN 'Same person transfer'
  WHEN 'Empréstimos e Financiamentos' THEN 'Loans and Financing'
  WHEN 'Taxas bancárias' THEN 'Bank fees'
  WHEN 'Impostos' THEN 'Taxes'
  WHEN 'Seguro' THEN 'Insurance'
  WHEN 'Doações' THEN 'Donations'
  WHEN 'Jogos de azar' THEN 'Gambling'
  WHEN 'Obrigações legais' THEN 'Legal obligations'
  WHEN 'Outros' THEN 'Other'
  -- Granular labels → base keys
  WHEN 'Supermercado & Alimentação' THEN 'Groceries'
  WHEN 'Restaurantes & Bares' THEN 'Food and drinks'
  WHEN 'Restaurantes e bares' THEN 'Food and drinks'
  WHEN 'Delivery de Comida' THEN 'Food and drinks'
  WHEN 'Aluguel' THEN 'Housing'
  WHEN 'Utilidades Domésticas' THEN 'Housing'
  WHEN 'Contas de consumo (Água, Luz, Gás)' THEN 'Housing'
  WHEN 'Uber / Táxi / Transporte' THEN 'Transportation'
  WHEN 'Postos de Combustível' THEN 'Transportation'
  WHEN 'Estacionamento' THEN 'Transportation'
  WHEN 'Manutenção Veicular' THEN 'Transportation'
  WHEN 'Automóvel' THEN 'Transportation'
  WHEN 'Aluguel de Carros' THEN 'Transportation'
  WHEN 'Telefone & Internet' THEN 'Services'
  WHEN 'Telecomunicações' THEN 'Services'
  WHEN 'Academias & Fitness' THEN 'Services'
  WHEN 'Bem-estar & Fitness' THEN 'Services'
  WHEN 'Compras & Lojas' THEN 'Shopping'
  WHEN 'Vestuário & Roupas' THEN 'Shopping'
  WHEN 'Saúde & Medicina' THEN 'Healthcare'
  WHEN 'Farmácia & Drogaria' THEN 'Healthcare'
  WHEN 'Odontologia' THEN 'Healthcare'
  WHEN 'Ótica & Visão' THEN 'Healthcare'
  WHEN 'Cinema, Teatro & Shows' THEN 'Leisure'
  WHEN 'Ingressos & Eventos' THEN 'Leisure'
  WHEN 'Games & Entretenimento' THEN 'Digital services'
  WHEN 'Salário & Renda' THEN 'Income'
  WHEN 'Tarifas Bancárias' THEN 'Bank fees'
  WHEN 'Pagamento de Fatura' THEN 'Transfers'
  ELSE category
END
WHERE category NOT IN (
  'Food and drinks', 'Groceries', 'Housing', 'Transportation', 'Services',
  'Shopping', 'Healthcare', 'Education', 'Leisure', 'Digital services',
  'Travel', 'Income', 'Investments', 'Transfers', 'Same person transfer',
  'Loans and Financing', 'Bank fees', 'Taxes', 'Insurance', 'Donations',
  'Gambling', 'Legal obligations', 'Other'
);

-- Handle potential duplicate keys after migration (same user, same base key)
-- Keep the one with higher limit, delete duplicates
WITH ranked AS (
  SELECT id, user_id, category,
    ROW_NUMBER() OVER (PARTITION BY user_id, category ORDER BY "limit" DESC) as rn
  FROM public.budgets
)
DELETE FROM public.budgets
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
