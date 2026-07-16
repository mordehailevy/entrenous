import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Currency } from '../types';
import type { BalancePoint } from '../utils/balance';
import { formatAmount, formatDate } from '../utils/format';

export function BalanceChart({ data, currency }: { data: BalancePoint[]; currency: Currency }) {
  if (data.length < 2) {
    return (
      <p className="py-6 text-center text-sm text-gray-400">
        Le graphique apparaîtra après quelques transactions confirmées.
      </p>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickFormatter={(v) => formatDate(v)}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            minTickGap={30}
          />
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Tooltip
            formatter={(value) => [formatAmount(Number(value), currency), 'Solde']}
            labelFormatter={(v) => formatDate(v as string)}
            contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="#7C3AED"
            strokeWidth={2}
            fill="url(#balanceGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
