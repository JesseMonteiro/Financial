import React, { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { AccountIcon } from './AccountIcon';
import { resolveCardFace } from '../utils/cardFaces';

const STATUS_LABEL = {
  paid: 'Paga',
  due: 'A pagar',
};

/**
 * Physical credit-card tile used in the Cartões strip and Momento bill carousel.
 */
export function CreditCardFace({
  account,
  lastFour,
  amountLabel,
  selected = false,
  uploading = false,
  onClick,
  onUpload,
  status,
}) {
  const face = resolveCardFace(account);
  const [broken, setBroken] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);
  const showPhoto = Boolean(face.src) && !broken;

  useEffect(() => {
    setBroken(false);
  }, [face.src]);

  const openPicker = () => {
    if (uploading) return;
    fileRef.current?.click();
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onUpload) return;
    setError(null);
    try {
      await onUpload(file);
    } catch (err) {
      setError(err.message || 'Falha ao enviar foto.');
    }
  };

  const interactive = typeof onClick === 'function';

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      className={`credit-card-face ${selected ? 'is-selected' : ''} ${showPhoto ? 'has-photo' : 'no-photo'} ${interactive ? '' : 'is-static'} tone-${face.textTone}`.trim()}
      title={account?.name}
      onClick={interactive ? () => onClick() : undefined}
      onKeyDown={interactive ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
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
          <span className="credit-card-face__meta">
            <AccountIcon account={account} size={22} />
            <span className="credit-card-face__name">{account?.name || face.productLabel}</span>
          </span>
        </span>
      )}
      <span className="credit-card-face__overlay">
        <span className="credit-card-face__last">Final {lastFour || '****'}</span>
        <span className="credit-card-face__amount">{amountLabel}</span>
      </span>
      {STATUS_LABEL[status] && (
        <span className={`credit-card-face__status is-${status}`}>
          {STATUS_LABEL[status]}
        </span>
      )}
      {onUpload && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            hidden
            onChange={handleFile}
          />
          <button
            type="button"
            className="credit-card-face__edit"
            title="Enviar foto do cartão"
            disabled={uploading}
            onClick={(e) => {
              e.stopPropagation();
              openPicker();
            }}
          >
            <Pencil size={12} />
          </button>
        </>
      )}
      {error && <span className="credit-card-face__error">{error}</span>}
    </div>
  );
}
