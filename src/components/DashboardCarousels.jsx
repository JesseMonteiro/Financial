import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Wallet,
  Sparkles,
  Percent,
  PiggyBank,
  Smartphone,
  TrendingDown,
  TrendingUp,
  ShoppingCart,
  CreditCard,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Sparkline } from './charts/Sparkline';
import { CategoryIcon } from './CategoryIcon';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { attrSelector, bindSnapSelect, centerChild } from '../utils/snapCarousel';
import { formatCurrency } from '../utils/formatters';
import { translateCategory } from '../utils/categories';

function insightAccent(type) {
  if (type === 'positive') return 'var(--success)';
  if (type === 'warning') return 'var(--danger)';
  return 'var(--info)';
}

function insightFooter(insight) {
  if (insight.generatedOnDevice) {
    return { icon: Smartphone, label: 'Gerado no dispositivo' };
  }
  if (insight.type === 'positive') {
    return { icon: TrendingDown, label: 'Economia identificada' };
  }
  return { icon: ShoppingCart, label: 'Classificação automática' };
}

function highlightPercents(text, accent) {
  const parts = String(text || '').split(/([+\-]?\d+%)/g);
  return parts.map((part, i) =>
    /^[+\-]?\d+%$/.test(part) ? (
      <strong key={i} style={{ color: accent, fontWeight: 700 }}>
        {part}
      </strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

function optimalInsightTypography(text) {
  const count = (text || '').length;
  if (count < 45) {
    return { fontSize: '1.05rem', lineHeight: 1.38, maxLines: 4 };
  }
  if (count < 75) {
    return { fontSize: '0.95rem', lineHeight: 1.32, maxLines: 4 };
  }
  if (count < 110) {
    return { fontSize: '0.85rem', lineHeight: 1.28, maxLines: 5 };
  }
  if (count < 150) {
    return { fontSize: '0.78rem', lineHeight: 1.22, maxLines: 6 };
  }
  return { fontSize: '0.74rem', lineHeight: 1.18, maxLines: 6 };
}

function useSnapCarousel(length, attr, { autoPlay = true } = {}) {
  const trackRef = useRef(null);
  const ignoreRef = useRef(false);
  const [index, setIndex] = useState(0);
  const [autoToken, setAutoToken] = useState(0);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    setIndex((prev) => (length <= 0 ? 0 : Math.min(prev, length - 1)));
  }, [length]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || length <= 1) return undefined;
    return bindSnapSelect(track, {
      attr,
      ignoreRef,
      onSelect: (id) => {
        const next = Number(id);
        if (!Number.isFinite(next) || next === index) return;
        setIndex(next);
        setAutoToken((t) => t + 1);
      },
    });
  }, [attr, index, length]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || length <= 0) return;
    const slide = track.querySelector(attrSelector(attr, index));
    if (!slide) return;
    ignoreRef.current = true;
    centerChild(track, slide, reduceMotion ? 'auto' : 'smooth');
    const t = window.setTimeout(() => {
      ignoreRef.current = false;
    }, 320);
    return () => clearTimeout(t);
  }, [attr, index, length, reduceMotion]);

  useEffect(() => {
    if (!autoPlay || reduceMotion || length <= 1) return undefined;
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % length);
    }, 3000);
    return () => clearInterval(id);
  }, [autoPlay, autoToken, length, reduceMotion]);

  return { trackRef, index, setIndex, setAutoToken };
}

function CarouselShell({ className = '', style, children, trackRef, label }) {
  return (
    <div className={`dash-carousel ${className}`.trim()} style={style} aria-roledescription="carousel" aria-label={label}>
      <div className="dash-carousel__track" ref={trackRef}>
        {children}
      </div>
    </div>
  );
}

export function InsightsCarousel({ insights = [], onShowAll }) {
  const slides = insights.length > 0 ? insights : [{ id: 'empty', type: 'neutral', text: '', empty: true }];
  const { trackRef, index } = useSnapCarousel(slides.length, 'data-insight-slide');
  const current = slides[Math.min(index, slides.length - 1)];
  const accent = current?.empty ? undefined : insightAccent(current?.type);

  return (
    <CarouselShell
      className={current?.empty ? 'dash-carousel--empty surface' : 'dash-carousel--insights'}
      style={
        accent
          ? {
              borderColor: `color-mix(in srgb, ${accent} 42%, var(--border-color))`,
              boxShadow: `0 10px 24px color-mix(in srgb, ${accent} 16%, transparent), var(--shadow-sm)`,
            }
          : undefined
      }
      trackRef={trackRef}
      label="Insights"
    >
      {slides.map((insight, i) => {
        if (insight.empty) {
          return (
            <div key={insight.id} className="dash-carousel__slide" data-insight-slide={i}>
              <div className="dash-carousel__header">
                <span className="dash-carousel__eyebrow">INSIGHTS</span>
              </div>
              <div className="dash-carousel__main">
                <h3 className="dash-carousel__title">Ainda sem insights</h3>
                <p className="dash-carousel__body dash-carousel__body--muted">
                  Conecte contas e sincronize para ver o que mudou nas suas finanças.
                </p>
              </div>
            </div>
          );
        }

        const accent = insightAccent(insight.type);
        const footer = insightFooter(insight);
        const FooterIcon = footer.icon;
        const typo = optimalInsightTypography(insight.text);

        return (
          <div
            key={insight.id}
            className={`dash-carousel__slide dash-carousel__slide--tint dash-carousel__slide--${insight.type}`}
            data-insight-slide={i}
            style={{ '--insight-accent': accent }}
          >
            <div className="dash-carousel__header">
              <span className="dash-carousel__eyebrow" style={{ color: accent }}>
                INSIGHTS
              </span>
              {onShowAll && (
                <button type="button" className="dash-carousel__all" style={{ color: accent }} onClick={onShowAll}>
                  Todos
                </button>
              )}
            </div>
            <p
              className="dash-carousel__body dash-carousel__body--insight"
              style={{
                fontSize: typo.fontSize,
                lineHeight: typo.lineHeight,
                WebkitLineClamp: typo.maxLines,
              }}
            >
              {highlightPercents(insight.text, accent)}
            </p>
            <div className="dash-carousel__footer">
              <FooterIcon size={14} />
              <span>{footer.label}</span>
            </div>
          </div>
        );
      })}
    </CarouselShell>
  );
}

export function KpiCarousel({
  summary,
  totalInvestments,
  bankCount,
  cashflow,
  mom,
  netWorthSeries,
  incomeExpenseSeries,
}) {
  const navigate = useNavigate();

  const slides = useMemo(
    () => [
      {
        id: 'net-worth',
        title: 'Patrimônio Líquido',
        value: summary.netWorth,
        valueColor: summary.netWorth >= 0 ? 'var(--text-primary)' : 'var(--danger)',
        subtitle: `Ativos: ${formatCurrency(summary.bankBalance + totalInvestments)} • Dívidas: -${formatCurrency(summary.creditDebt)}`,
        icon: Sparkles,
        iconBg: 'var(--primary-light)',
        iconColor: 'var(--primary)',
        sparkline: { data: netWorthSeries, dataKey: 'patrimônio', color: 'var(--primary)' },
      },
      {
        id: 'bank-balance',
        title: 'Saldo em Contas',
        value: summary.bankBalance,
        valueColor: 'var(--text-primary)',
        subtitle:
          `${bankCount} ${bankCount === 1 ? 'conta bancária' : 'contas bancárias'}` +
          (summary.reservedBalance > 0
            ? ` · caixinhas ${formatCurrency(summary.reservedBalance)} em investimentos`
            : ''),
        icon: Wallet,
        iconBg: 'rgba(16, 185, 129, 0.12)',
        iconColor: 'var(--success)',
        sparkline: { data: incomeExpenseSeries, dataKey: 'net', color: 'var(--success)' },
      },
      {
        id: 'savings-rate',
        title: 'Taxa de Poupança',
        valueLabel: cashflow.savingsRate == null ? '—' : `${cashflow.savingsRate.toFixed(0)}%`,
        valueColor: (cashflow.savingsRate ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)',
        subtitle: `Líquido do mês: ${formatCurrency(cashflow.net)}`,
        icon: Percent,
        iconBg: 'rgba(59, 130, 246, 0.12)',
        iconColor: 'var(--info)',
        sparkline: { data: incomeExpenseSeries, dataKey: 'net', color: 'var(--info)' },
      },
      {
        id: 'mom-expense',
        title: 'Gastos vs Mês Ant.',
        valueLabel: `${mom.expenseDeltaPct > 0 ? '+' : ''}${mom.expenseDeltaPct.toFixed(0)}%`,
        valueColor: mom.expenseDeltaPct > 0 ? 'var(--danger)' : 'var(--success)',
        subtitle: `Este mês ${formatCurrency(cashflow.expense)} · ant. ${formatCurrency(mom.previous.expense)}`,
        icon: PiggyBank,
        iconBg: 'rgba(244, 63, 94, 0.12)',
        iconColor: 'var(--danger)',
        sparkline: { data: incomeExpenseSeries, dataKey: 'despesa', color: 'var(--danger)' },
      },
      {
        id: 'investments',
        title: 'Investimentos',
        value: totalInvestments,
        valueColor: 'var(--text-primary)',
        subtitle: 'Carteira consolidada aplicada',
        icon: TrendingUp,
        iconBg: 'rgba(59, 130, 246, 0.12)',
        iconColor: 'var(--info)',
        sparkline: { data: netWorthSeries, dataKey: 'patrimônio', color: 'var(--info)' },
        link: '/investments',
      },
      {
        id: 'credit-debt',
        title: 'Saldo Devedor',
        value: summary.creditDebt,
        valueColor: 'var(--danger)',
        subtitle: 'Faturas e parcelas abertas',
        icon: CreditCard,
        iconBg: 'rgba(239, 68, 68, 0.12)',
        iconColor: 'var(--danger)',
        sparkline: { data: incomeExpenseSeries, dataKey: 'despesa', color: 'var(--danger)' },
        link: '/credit-cards',
      },
    ],
    [summary, totalInvestments, bankCount, cashflow, mom, netWorthSeries, incomeExpenseSeries]
  );

  const { trackRef } = useSnapCarousel(slides.length, 'data-kpi-slide');

  return (
    <CarouselShell className="dash-carousel--kpi surface" trackRef={trackRef} label="Indicadores financeiros">
      {slides.map((slide, i) => {
        const Icon = slide.icon;
        return (
          <div
            key={slide.id}
            className={`dash-carousel__slide ${slide.link ? 'cursor-pointer' : ''}`}
            data-kpi-slide={i}
            onClick={slide.link ? () => navigate(slide.link) : undefined}
          >
            <div className="dash-carousel__header">
              <span className="dash-carousel__eyebrow dash-carousel__eyebrow--muted">{slide.title}</span>
              <div className="dash-carousel__icon" style={{ background: slide.iconBg, color: slide.iconColor }}>
                <Icon size={18} />
              </div>
            </div>
            <div className="dash-carousel__main">
              <h2 className="dash-carousel__value" style={{ color: slide.valueColor }}>
                {slide.valueLabel ?? formatCurrency(slide.value)}
              </h2>
              <p className="dash-carousel__subtitle">{slide.subtitle}</p>
            </div>
            <div className="dash-carousel__spark">
              <Sparkline data={slide.sparkline.data} dataKey={slide.sparkline.dataKey} color={slide.sparkline.color} height={32} />
            </div>
          </div>
        );
      })}
    </CarouselShell>
  );
}

export function CreditPurchasesCarousel({ purchases = [], onSelect }) {
  const slides = purchases.length > 0 ? purchases : [];
  const { trackRef } = useSnapCarousel(slides.length, 'data-purchase-slide', { autoPlay: false });

  if (slides.length === 0) return null;

  return (
    <CarouselShell className="dash-carousel--purchases surface" trackRef={trackRef} label="Últimas compras no cartão">
      {slides.map((purchase, i) => {
        const subtitle = [translateCategory(purchase.category), purchase.dateRelative, purchase.accountName]
          .filter(Boolean)
          .join(' · ');
        return (
          <div
            key={purchase.id}
            className="dash-carousel__slide dash-carousel__slide--purchase list-row--clickable"
            data-purchase-slide={i}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            onClick={onSelect ? () => onSelect(purchase) : undefined}
            onKeyDown={
              onSelect
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelect(purchase);
                    }
                  }
                : undefined
            }
          >
            <CategoryIcon
              category={purchase.category}
              title={purchase.description}
              size={36}
              emptyFallback="receipt"
            />
            <div className="dash-carousel__purchase-main">
              <span className="dash-carousel__eyebrow dash-carousel__eyebrow--muted">Últimas compras</span>
              <p className="dash-carousel__purchase-title">{purchase.description}</p>
              <span className="dash-carousel__purchase-meta">{subtitle}</span>
            </div>
            <span className="dash-carousel__purchase-amount">
              - {formatCurrency(Math.abs(Number(purchase.amount) || 0))}
            </span>
          </div>
        );
      })}
    </CarouselShell>
  );
}
