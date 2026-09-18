'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import { format, subDays, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

const CYAN = '#00e5d1';
const DARK_BG = '#0a0a0a';
const CARD_BG = '#111111';
const CARD_BORDER = '#222222';
const LABEL_COLOR = '#888888';

const TAG_LABELS: Record<string, string> = {
  asesoriamigracion: 'ASESORÍAS MIGRACIÓN',
  mitaciones: 'MUTACIONES',
  certificados: 'CERTIFICADOS',
  tramites: 'TRÁMITES',
  renovaciones: 'RENOVACIONES',
  infogeneral: 'INFO GENERAL',
  tunegocio: 'TU NEGOCIO',
  asesorialegal: 'ASESORÍA LEGAL',
};

type Metrics = {
  totalLeads: number;
  atendidosMigracion: number;
  sinReplica: number;
  tagCounts: Record<string, number>;
  leadsPerDay: Array<{ day: string; count: number }>;
  totalInDB: number;
};

type DatePreset = '7d' | '30d' | 'mes' | '90d';

function MetricCard({
  title,
  value,
  delta,
  subtitle,
}: {
  title: string;
  value: string | number;
  delta?: string;
  subtitle?: string;
}) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 10,
        padding: '20px 22px',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: LABEL_COLOR, marginBottom: 12 }}>
        {title}
      </div>
      <div style={{ fontSize: 36, fontWeight: 700, color: CYAN, lineHeight: 1, marginBottom: 4 }}>
        {typeof value === 'number' ? value.toLocaleString('es-CO') : value}
      </div>
      {subtitle && (
        <div style={{ fontSize: 12, color: '#444', marginTop: 4 }}>{subtitle}</div>
      )}
      <div style={{ borderTop: `1px solid ${CARD_BORDER}`, margin: '12px 0 8px' }} />
      {delta && (
        <div style={{ fontSize: 12, color: CYAN }}>{delta}</div>
      )}
    </div>
  );
}

export default function DashboardClient({ initialMetrics }: { initialMetrics: Metrics }) {
  const [metrics, setMetrics] = useState<Metrics>(initialMetrics);
  const [loading, setLoading] = useState(false);
  const [preset, setPreset] = useState<DatePreset>('30d');
  const [from, setFrom] = useState(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const fetchMetrics = useCallback(async (fromDate: string, toDate: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/metrics?from=${fromDate}&to=${toDate}`);
      const data = await res.json();
      setMetrics(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics(from, to);
  }, [from, to, fetchMetrics]);

  function applyPreset(p: DatePreset) {
    setPreset(p);
    const today = new Date();
    let newFrom: Date;
    if (p === '7d') newFrom = subDays(today, 7);
    else if (p === '30d') newFrom = subDays(today, 30);
    else if (p === 'mes') newFrom = startOfMonth(today);
    else newFrom = subDays(today, 90);
    setFrom(format(newFrom, 'yyyy-MM-dd'));
    setTo(format(today, 'yyyy-MM-dd'));
  }

  const tc = metrics.tagCounts || {};

  // Order of tag cards matching the screenshot
  const tagOrder = ['asesoriamigracion', 'mitaciones', 'certificados', 'tramites', 'renovaciones'];
  const tagOrder2 = ['infogeneral', 'tunegocio', 'asesorialegal'];

  const chartData = (metrics.leadsPerDay || []).map(d => ({
    day: format(new Date(d.day), 'd/MM', { locale: es }),
    leads: d.count,
  }));

  const btnStyle = (active: boolean) => ({
    padding: '6px 14px',
    borderRadius: 6,
    border: `1px solid ${active ? CYAN : CARD_BORDER}`,
    background: active ? 'rgba(0,229,209,0.1)' : 'transparent',
    color: active ? CYAN : LABEL_COLOR,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: active ? 700 : 400,
    transition: 'all 0.15s',
  });

  return (
    <div style={{ background: DARK_BG, minHeight: '100vh', padding: '32px 24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: 0 }}>
            Dashboard · Cámara de Comercio de Soacha
          </h1>
          <p style={{ color: LABEL_COLOR, fontSize: 13, marginTop: 6 }}>
            {metrics.totalInDB.toLocaleString('es-CO')} contactos en base · datos desde Kommo CRM
          </p>
        </div>

        {/* Date presets */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['7d', 'mes', '30d', '90d'] as DatePreset[]).map(p => (
            <button key={p} onClick={() => applyPreset(p)} style={btnStyle(preset === p)}>
              {p === '7d' ? '7 días' : p === 'mes' ? 'Este mes' : p === '30d' ? '30 días' : '90 días'}
            </button>
          ))}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input
              type="date"
              value={from}
              onChange={e => { setFrom(e.target.value); setPreset('30d'); }}
              style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: '#fff', padding: '5px 8px', borderRadius: 6, fontSize: 12 }}
            />
            <span style={{ color: LABEL_COLOR }}>→</span>
            <input
              type="date"
              value={to}
              onChange={e => { setTo(e.target.value); setPreset('30d'); }}
              style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: '#fff', padding: '5px 8px', borderRadius: 6, fontSize: 12 }}
            />
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ color: CYAN, fontSize: 13, marginBottom: 16 }}>Actualizando datos...</div>
      )}

      {/* Chart */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 4 }}>Interacciones diarias</div>
        <div style={{ fontSize: 12, color: LABEL_COLOR, marginBottom: 16 }}>Personas que contactaron al Salesbot por día</div>
        <div style={{ height: 200 }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ left: 0, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: LABEL_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: LABEL_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} />
                <RechartsTooltip
                  contentStyle={{ background: '#1a1a1a', border: `1px solid ${CARD_BORDER}`, borderRadius: 6, color: '#fff' }}
                  labelStyle={{ color: LABEL_COLOR }}
                />
                <Line type="monotone" dataKey="leads" stroke={CYAN} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: CYAN }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: LABEL_COLOR, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              Sin datos para este período
            </div>
          )}
        </div>
      </div>

      {/* Row 1: Tag metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 12, marginBottom: 12 }}>
        {tagOrder.map(tag => (
          <MetricCard
            key={tag}
            title={TAG_LABELS[tag]}
            value={tc[tag] || 0}
            delta={`+${tc[tag] || 0} en el período`}
          />
        ))}
        <MetricCard
          title="DIÁLOGOS SIN RÉPLICA"
          value={metrics.sinReplica}
          delta="en estado: Contacto inicial"
        />
      </div>

      {/* Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
        {tagOrder2.map(tag => (
          <MetricCard
            key={tag}
            title={TAG_LABELS[tag]}
            value={tc[tag] || 0}
            delta={`+${tc[tag] || 0} en el período`}
          />
        ))}
        <MetricCard
          title="ATENDIDOS MIGRACIÓN"
          value={metrics.atendidosMigracion}
          subtitle="Estado: migración / migración atendido"
          delta={`+${metrics.atendidosMigracion} en el período`}
        />
      </div>

      {/* Row 3: Summary metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <MetricCard
          title="TOTAL INTERACCIONES"
          value={metrics.totalLeads}
          delta="en el período seleccionado"
        />
        <MetricCard
          title="DIÁLOGOS VIGENTES"
          value={metrics.totalInDB}
          delta="total en base de datos (parcial)"
        />
        <MetricCard
          title="TRÁMITES REGISTRALES"
          value={(tc['certificados'] || 0) + (tc['tramites'] || 0) + (tc['renovaciones'] || 0) + (tc['mitaciones'] || 0)}
          delta="certificados + trámites + renovaciones + mutaciones"
        />
        <MetricCard
          title="IDENTIFICADOS POR BOT"
          value={Object.values(tc).reduce((a, b) => a + b, 0)}
          delta={`de ${metrics.totalLeads} interacciones`}
        />
      </div>

      {/* Footer note */}
      <div style={{ marginTop: 24, color: '#333', fontSize: 11, textAlign: 'center' }}>
        Datos sincronizados desde Kommo CRM · contactenoscamaradecomerciosoachaorgco.kommo.com
        · {metrics.totalInDB.toLocaleString('es-CO')} contactos en la base local
      </div>
    </div>
  );
}
