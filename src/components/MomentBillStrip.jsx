import React from 'react';
import { CreditCardFace } from './CreditCardFace';
import { accountById } from './AccountIcon';
import { formatCurrency } from '../utils/formatters';

export function MomentBillStrip({ bills, accounts }) {
  return (
    <div className="chip-scroll credit-card-strip">
      {bills.map((b, i) => {
        const account = accountById(accounts, b.cardId);
        return (
          <div className="credit-card-slide" key={b.cardId || i}>
            <CreditCardFace
              account={account}
              lastFour={account?.number || '****'}
              amountLabel={formatCurrency(b.amount)}
              status={b.isPaid ? 'paid' : 'due'}
              ownerLabel={b.ownerLabel || account?.ownerLabel}
            />
          </div>
        );
      })}
    </div>
  );
}
