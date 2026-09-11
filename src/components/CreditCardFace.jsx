import React, { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { resolveCardFace } from '../utils/cardFaces';

/**
 * Physical credit-card tile for the Cartões de Crédito strip only.
 */
export function CreditCardFace({
  account,
  lastFour,
  amountLabel,
  selected = false,
  onClick,
  onEdit,
}) {
  const face = resolveCardFace(account);
  const [broken, setBroken] = useState(false);
  const pressTimer = useRef(null);
  const showPhoto = Boolean(face.src) && !broken;

  useEffect(() => {
    setBroken(false);
  }, [face.src]);

  const clearPress = () => {
    if (pressTimer.current && pressTimer.current !== 'fired') {
      clearTimeout(pressTimer.current);
    }
    pressTimer.current = null;
  };

  const startPress = (e) => {
    if (!onEdit || e.pointerType === 'touch') return;
    pressTimer.current = setTimeout(() => {
      pressTimer.current = 'fired';
      onEdit();
    }, 550);
  };

  const handleActivate = () => {
    if (pressTimer.current === 'fired') return;
    onClick?.();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={`credit-card-face ${selected ? 'is-selected' : ''} tone-${face.textTone}`}
      title={account?.name}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleActivate();
        }
      }}
      onPointerDown={startPress}
      onPointerUp={clearPress}
      onPointerLeave={clearPress}
      onContextMenu={(e) => {
        e.preventDefault();
        onEdit?.();
      }}
    >
      {showPhoto ? (
        <img
          className="credit-card-face__art"
          src={face.src}
          alt=""
          draggable={false}
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="credit-card-face__css" style={{ background: face.cssBackground }}>
          {face.logoUrl ? (
            <img className="credit-card-face__logo" src={face.logoUrl} alt="" />
          ) : (
            <span className="credit-card-face__brand">{face.productLabel}</span>
          )}
          <span className="credit-card-face__chip" aria-hidden />
          <span className="credit-card-face__contactless" aria-hidden />
          <span className="credit-card-face__product">{face.productLabel}</span>
        </span>
      )}
      <span className="credit-card-face__overlay">
        <span className="credit-card-face__last">Final {lastFour || '****'}</span>
        <span className="credit-card-face__amount">{amountLabel}</span>
      </span>
      {onEdit && (
        <button
          type="button"
          className="credit-card-face__edit"
          title="Alterar ícone"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Pencil size={12} />
        </button>
      )}
    </div>
  );
}
