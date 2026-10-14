import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Currency } from '../types';
import type { BalancePoint, DebtPoint } from '../utils/balance';
import { computeDebtHistory, computeRepaidTotal } from '../utils/balance';
import { formatAmount, formatDate } from '../utils/format';

interface BalanceChartProps {
  /** Historique du solde validé, du point de vue du viewer (positif = on lui doit). */
  data: BalancePoint[];
  currency: Currency;
  theyOweYouLabel: string;
  youOweThemLabel: string;
}

export function BalanceChart({ data, currency, theyOweYouLabel, youOweThemLabel }: BalanceChartProps) {
  const points = useMemo(() => computeDebtHistory(data), [data]);
  const repaid = useMemo(() => computeRepaidTotal(points), [points]);

  if (points.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-400">
        Le graphique apparaîtra dès la première transaction confirmée.
      </p>
    );
  }

  const current = points[points.length - 1];
  const peak = Math.max(...points.map((p) => p.remaining));
  const total = repaid + current.remaining;
  const progress = peak > 0 && total > 0 ? Math.min(100, Math.round((repaid / total) * 100)) : 0;
  const remainingPct = total > 0 ? 100 - progress : 0;
  const first = points[0].time;
  const ticks = Array.from({ length: 4 }, (_, i) => first + ((current.time - first) * i) / 3);
  const color = current.balance < 0 ? '#DC2626' : '#16A34A';

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs text-gray-500">Reste à rembourser</p>
          <p className="text-2xl font-semibold text-ink">
            {formatAmount(current.remaining, currency)}
            {total > 0 && (
              <span className="ml-2 text-base font-medium" style={{ color }}>
                {remainingPct} %
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Déjà remboursé</p>
          <p className="text-sm font-semibold text-ink">
            {formatAmount(repaid, currency)}
            {repaid > 0 && <span className="ml-1 font-normal text-gray-500">({progress} %)</span>}
          </p>
        </div>
      </div>

      {total > 0 && (
        <div
          className="mb-4 h-2 w-full overflow-hidden rounded-full bg-gray-100"
          role="progressbar"
          aria-valuenow={remainingPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Il reste ${remainingPct} % à rembourser`}
        >
          <div className="h-full rounded-full" style={{ width: `${remainingPct}%`, backgroundColor: color }} />
        </div>
      )}

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="debtGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#f3f4f6" />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              ticks={ticks}
              tickFormatter={(v) =>
                new Date(v).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
              }
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              minTickGap={30}
            />
            <YAxis
              domain={[0, 'auto']}
              width={48}
              tickFormatter={(v) => Number(v).toLocaleString('fr-FR', { notation: 'compact' })}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value, _name, item) => {
                const p = item.payload as DebtPoint;
                const label = p.balance === 0 ? 'Soldé' : p.balance > 0 ? theyOweYouLabel : youOweThemLabel;
                return [formatAmount(Number(value), currency), label];
              }}
              labelFormatter={(v) => formatDate(new Date(Number(v)).toISOString())}
              contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }}
            />
            <Area
              type="stepAfter"
              dataKey="remaining"
              stroke={color}
              strokeWidth={2}
              fill="url(#debtGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
