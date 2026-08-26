import { sumReservedBalances } from './reservedBalances.js';

export function calculateNetWorth(accounts = [], investments = [], loans = []) {
  let availableBankBalance = 0;
  let reservedBalance = 0;

  for (const a of accounts) {
    if (a.type !== 'BANK') continue;
    availableBankBalance += a.balance || 0;
    reservedBalance += sumReservedBalances(a);
  }

  // Total held in bank products (available + caixinhas / reserved balances)
  const bankBalance = availableBankBalance + reservedBalance;

  const creditDebt = accounts.reduce((acc, a) => {
    if (a.type === 'CREDIT') return acc + Math.abs(a.balance || 0);
    return acc;
  }, 0);

  const investmentTotal = investments.reduce((acc, i) => acc + (i.balance || i.amount || 0), 0);

  const loansTotal = loans.reduce((acc, l) => acc + (l.balance || 0), 0);

  const totalAssets = bankBalance + investmentTotal;
  const totalLiabilities = creditDebt + loansTotal;

  return {
    netWorth: totalAssets - totalLiabilities,
    totalAssets,
    totalLiabilities,
    bankBalance,
    availableBankBalance,
    reservedBalance,
    investmentTotal,
    creditDebt,
    loansTotal
  };
}

export function groupTransactionsByCategory(transactions = []) {
  const categoriesMap = {};
  
  transactions.forEach(t => {
    if (t.amount < 0 || t.type === 'DEBIT') {
      const categoryName = t.category || 'Outros';
      const absAmount = Math.abs(t.amount);
      
      if (!categoriesMap[categoryName]) {
        categoriesMap[categoryName] = {
          name: categoryName,
          value: 0,
          count: 0
        };
      }
      categoriesMap[categoryName].value += absAmount;
      categoriesMap[categoryName].count += 1;
    }
  });

  return Object.values(categoriesMap).sort((a, b) => b.value - a.value);
}

export function calculateIncomeVsExpense(transactions = []) {
  let income = 0;
  let expense = 0;

  transactions.forEach(t => {
    const val = Number(t.amount);
    if (val > 0 || t.type === 'CREDIT_INCOME') {
      income += Math.abs(val);
    } else {
      expense += Math.abs(val);
    }
  });

  return { income, expense, net: income - expense };
}
