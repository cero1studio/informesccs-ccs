'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import { format, subDays, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

// ── Paleta corporativa CCS ───────────────────────────────────────────────────
const RED     = '#D0222A';   // rojo CCS
const RED_DIM = '#9b1a20';
const DARK_BG = '#0d0d0d';
const CARD_BG = '#141414';
const HEADER_BG = '#111111';
const BORDER  = '#232323';
const MUTED   = '#5a5a5a';
const TEXT    = '#d4d4d4';
const WHITE   = '#ffffff';

type Metrics = {
  totalLeads: number;
  atendidosMigracion: number;
  enProcesoMigracion: number;
  completadosMigracion: number;
  atendidosLegal: number;
  enProcesoLegal: number;
  completadosLegal: number;
  enEsperaMigracion: number;
  enEsperaLegal: number;
  sinReplica: number;
  tagCounts: Record<string, number>;
  leadsPerDay: Array<{ day: string; count: number }>;
  totalInDB: number;
};

type DatePreset = '7d' | '15d' | '30d' | 'mes' | '90d';

// ── Tooltip de ayuda ─────────────────────────────────────────────────────────
function Tip({ text }: { text: string }) {
  const [on, setOn] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: 5 }}>
      <span
        onMouseEnter={() => setOn(true)}
        onMouseLeave={() => setOn(false)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 13, height: 13, borderRadius: '50%',
          border: `1px solid #383838`, color: '#484848', fontSize: 9, cursor: 'help',
        }}
      >?</span>
      {on && (
        <span style={{
          position: 'absolute', bottom: '120%', left: 0,
          background: '#1e1e1e', border: `1px solid #2e2e2e`, borderRadius: 7,
          padding: '9px 11px', fontSize: 11, color: '#aaa', width: 230,
          zIndex: 200, lineHeight: 1.55, whiteSpace: 'normal',
          boxShadow: '0 6px 24px rgba(0,0,0,0.8)',
        }}>
          {text}
        </span>
      )}
    </span>
  );
}

// ── Tarjeta de métrica ────────────────────────────────────────────────────────
function Card({
  label, value, sub, tip, variant = 'default',
}: {
  label: string;
  value: number | string;
  sub?: string;
  tip?: string;
  variant?: 'default' | 'alert' | 'success' | 'neutral';
}) {
  const color =
    variant === 'alert'   ? '#e05050' :
    variant === 'success' ? '#4caf7d' :
    variant === 'neutral' ? '#888'    :
    RED;

  return (
    <div style={{
      background: CARD_BG,
      border: `1px solid ${BORDER}`,
      borderTop: `2px solid ${variant === 'alert' ? '#e05050' : variant === 'success' ? '#4caf7d' : BORDER}`,
      borderRadius: 8,
      padding: '14px 16px', minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: MUTED, textTransform: 'uppercase' }}>
          {label}
        </span>
        {tip && <Tip text={tip} />}
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, color }}>
        {typeof value === 'number' ? value.toLocaleString('es-CO') : value}
      </div>
      {sub && (
        <div style={{ marginTop: 8, borderTop: `1px solid ${BORDER}`, paddingTop: 7, fontSize: 10, color: '#3a3a3a' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Encabezado de sección ─────────────────────────────────────────────────────
function Section({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 10, paddingBottom: 8,
        borderBottom: `1px solid #1c1c1c`,
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 22, height: 22, borderRadius: 4,
          background: 'rgba(208,34,42,0.1)', fontSize: 12,
        }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: TEXT, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

function CardGrid({ children, cols = 'repeat(auto-fit, minmax(155px, 1fr))' }: { children: React.ReactNode; cols?: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10 }}>
      {children}
    </div>
  );
}

function PresetBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 11px', borderRadius: 5, fontSize: 11, cursor: 'pointer',
      border: `1px solid ${active ? RED : BORDER}`,
      background: active ? 'rgba(208,34,42,0.1)' : 'transparent',
      color: active ? '#e06060' : MUTED,
      fontWeight: active ? 700 : 400,
      transition: 'all 0.15s',
    }}>
      {label}
    </button>
  );
}

// ── Dashboard principal ───────────────────────────────────────────────────────
export default function DashboardClient({ initialMetrics }: { initialMetrics: Metrics }) {
  const [metrics, setMetrics] = useState<Metrics>(initialMetrics);
  const [loading, setLoading] = useState(false);
  const [preset, setPreset]   = useState<DatePreset>('30d');
  const [from, setFrom]       = useState(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo]           = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [glossary, setGlossary] = useState(false);

  const fetchMetrics = useCallback(async (f: string, t: string) => {
    setLoading(true);
    try {
      const data = await fetch(`/api/metrics?from=${f}&to=${t}`).then(r => r.json());
      setMetrics(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMetrics(from, to); }, [from, to, fetchMetrics]);

  function applyPreset(p: DatePreset) {
    setPreset(p);
    const today = new Date();
    const newFrom =
      p === '7d'  ? subDays(today, 7)  :
      p === '15d' ? subDays(today, 15) :
      p === 'mes' ? startOfMonth(today) :
      p === '90d' ? subDays(today, 90) :
      subDays(today, 30);
    setFrom(format(newFrom, 'yyyy-MM-dd'));
    setTo(format(today, 'yyyy-MM-dd'));
  }

  const tc = metrics.tagCounts || {};
  const totalTagCount = Object.values(tc).reduce((a, b) => a + b, 0);

  const chartData = (metrics.leadsPerDay || []).map(d => ({
    día: format(new Date(d.day), 'd/MM', { locale: es }),
    leads: d.count,
  }));

  const presets: { key: DatePreset; label: string }[] = [
    { key: '7d',  label: '7 días' },
    { key: '15d', label: '15 días' },
    { key: 'mes', label: 'Este mes' },
    { key: '30d', label: '30 días' },
    { key: '90d', label: '90 días' },
  ];

  return (
    <div style={{ background: DARK_BG, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Barra de marca ── */}
      <div style={{
        background: HEADER_BG,
        borderBottom: `1px solid ${BORDER}`,
        padding: '0 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 56,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            background: WHITE, borderRadius: 6, padding: '4px 10px',
            display: 'flex', alignItems: 'center',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://camaradecomerciosoacha.org.co/wp-content/uploads/2024/04/image-9-2.png"
              alt="Cámara de Comercio de Soacha"
              style={{ height: 28, objectFit: 'contain' }}
            />
          </div>
          <div style={{ width: 1, height: 24, background: BORDER }} />
          <span style={{ fontSize: 12, color: MUTED, letterSpacing: '0.04em' }}>Panel de Métricas</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {loading && (
            <span style={{ fontSize: 11, color: RED, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                background: RED, animation: 'pulse 1s infinite',
              }} />
              Actualizando
            </span>
          )}
          <button
            onClick={() => setGlossary(v => !v)}
            style={{
              padding: '5px 11px', borderRadius: 5, fontSize: 11, cursor: 'pointer',
              border: `1px solid ${glossary ? RED : BORDER}`,
              background: glossary ? 'rgba(208,34,42,0.1)' : 'transparent',
              color: glossary ? '#e06060' : MUTED,
            }}
          >
            {glossary ? '✕ Cerrar glosario' : '📖 Glosario'}
          </button>
        </div>
      </div>

      {/* ── Contenido ── */}
      <div style={{ padding: '22px 28px' }}>

        {/* ── Glosario ── */}
        {glossary && (
          <div style={{
            background: '#131313', border: `1px solid #222`, borderRadius: 8,
            padding: '16px 20px', marginBottom: 18,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: WHITE, marginBottom: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Glosario de métricas</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px 28px' }}>
              {[
                { t: 'Leads diarios', d: 'Personas nuevas que iniciaron conversación con el Salesbot ese día (leads creados en Kommo).' },
                { t: 'Etiquetas (Certificados, Trámites…)', d: 'El bot asigna estas etiquetas al contacto cuando selecciona esa opción del menú. Una persona puede tener varias → la suma puede superar el total de leads.' },
                { t: 'Solicitaron (tag)', d: 'Personas que pidieron ese servicio al bot en el período. Es la demanda bruta.' },
                { t: 'En proceso', d: 'Lead asignado al pipeline de atención pero aún no cerrado. El asesor lo está trabajando.' },
                { t: 'Completados', d: 'Lead marcado como "atendido" en Kommo. Atención finalizada.' },
                { t: 'En espera (backlog)', d: 'Total acumulado de personas con el tag pero cuyo lead nunca entró al pipeline. Sin filtro de fecha — es la cola real pendiente.' },
                { t: 'Sin atención humana', d: 'Leads nuevos del período que no fueron derivados a ningún flujo de atención. El bot pudo responder, pero no hubo seguimiento de asesor.' },
              ].map(item => (
                <div key={item.t}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#c04040', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.t}</div>
                  <div style={{ fontSize: 11, color: '#777', lineHeight: 1.6 }}>{item.d}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Filtros ── */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
          {presets.map(p => (
            <PresetBtn key={p.key} label={p.label} active={preset === p.key} onClick={() => applyPreset(p.key)} />
          ))}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginLeft: 4 }}>
            <input type="date" value={from}
              onChange={e => { setFrom(e.target.value); setPreset('30d'); }}
              style={{ background: CARD_BG, border: `1px solid ${BORDER}`, color: TEXT, padding: '4px 8px', borderRadius: 5, fontSize: 11 }} />
            <span style={{ color: MUTED, fontSize: 12 }}>→</span>
            <input type="date" value={to}
              onChange={e => { setTo(e.target.value); setPreset('30d'); }}
              style={{ background: CARD_BG, border: `1px solid ${BORDER}`, color: TEXT, padding: '4px 8px', borderRadius: 5, fontSize: 11 }} />
          </div>
        </div>

        {/* ── Gráfica ── */}
        <div style={{
          background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8,
          padding: '16px 20px', marginBottom: 22,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: WHITE }}>Leads diarios que llegan</span>
            <span style={{ fontSize: 11, color: MUTED }}>
              Total período: <strong style={{ color: RED }}>{metrics.totalLeads.toLocaleString('es-CO')}</strong>
            </span>
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 14 }}>
            Personas nuevas que iniciaron conversación con el bot por día
          </div>
          <div style={{ height: 170 }}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                  <XAxis dataKey="día" tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{ background: '#1c1c1c', border: `1px solid #2a2a2a`, borderRadius: 6, color: WHITE }}
                    labelStyle={{ color: MUTED }}
                    formatter={(v) => [`${v} personas`, 'Leads']}
                  />
                  <Line type="monotone" dataKey="leads" stroke={RED} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: RED }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: MUTED, fontSize: 13 }}>
                Sin datos para este período
              </div>
            )}
          </div>
        </div>

        {/* ── Aviso doble conteo ── */}
        {totalTagCount > metrics.totalLeads && (
          <div style={{
            background: 'rgba(208,34,42,0.04)', border: `1px solid rgba(208,34,42,0.12)`,
            borderRadius: 6, padding: '8px 14px', marginBottom: 18,
            fontSize: 11, color: '#666', lineHeight: 1.5,
          }}>
            ℹ La suma de etiquetas (<strong style={{ color: '#c04040' }}>{totalTagCount.toLocaleString('es-CO')}</strong>) supera el total de leads (<strong style={{ color: '#c04040' }}>{metrics.totalLeads.toLocaleString('es-CO')}</strong>) porque una misma persona puede haber seleccionado varios temas en el bot.
          </div>
        )}

        {/* ════════ MIGRACIÓN ════════ */}
        <Section label="Migración" icon="🛂">
          <CardGrid cols="repeat(auto-fit, minmax(150px, 1fr))">
            <Card
              label="Solicitaron asesoría"
              value={tc['asesoriamigracion'] || 0}
              sub="Nuevas solicitudes con tag migración"
              tip="Contactos que seleccionaron Migración en el bot durante el período. Es la demanda recibida."
            />
            <Card
              label="En proceso"
              value={metrics.enProcesoMigracion}
              sub="Asignados — aún no cerrados"
              tip="Leads movidos al status 'migración' en Kommo durante el período. El asesor los está trabajando."
              variant="neutral"
            />
            <Card
              label="Completados"
              value={metrics.completadosMigracion}
              sub="Marcados como 'migración atendido'"
              tip="Leads cerrados con status 'migración atendido'. Atención finalizada."
              variant="success"
            />
            <Card
              label="En espera (backlog)"
              value={metrics.enEsperaMigracion}
              sub="Con tag pero nunca al pipeline"
              tip="Total acumulado histórico. Personas que pidieron migración al bot pero nunca fueron derivadas al pipeline. Sin filtro de fecha."
              variant={metrics.enEsperaMigracion > 0 ? 'alert' : 'default'}
            />
          </CardGrid>
        </Section>

        {/* ════════ ASESORÍA LEGAL ════════ */}
        <Section label="Asesoría Legal" icon="⚖️">
          <CardGrid cols="repeat(auto-fit, minmax(150px, 1fr))">
            <Card
              label="Solicitaron abogado"
              value={tc['asesorialegal'] || 0}
              sub="Nuevas solicitudes con tag legal"
              tip="Contactos que seleccionaron Asesoría Legal en el bot durante el período."
            />
            <Card
              label="En proceso"
              value={metrics.enProcesoLegal}
              sub="Asignados — aún no cerrados"
              tip="Leads movidos al status 'abogado' en Kommo durante el período. El abogado los está atendiendo."
              variant="neutral"
            />
            <Card
              label="Completados"
              value={metrics.completadosLegal}
              sub="Marcados como 'abogado atendido'"
              tip="Leads cerrados con status 'abogado atendido'. Asesoría legal finalizada."
              variant="success"
            />
            <Card
              label="En espera (backlog)"
              value={metrics.enEsperaLegal}
              sub="Con tag pero nunca al pipeline"
              tip="Total acumulado histórico. Personas que pidieron abogado al bot pero nunca fueron derivadas al pipeline."
              variant={metrics.enEsperaLegal > 0 ? 'alert' : 'default'}
            />
          </CardGrid>
        </Section>

        {/* ════════ TRÁMITES REGISTRALES ════════ */}
        <Section label="Trámites Registrales" icon="📋">
          <CardGrid>
            <Card label="Certificados" value={tc['certificados'] || 0} sub="Certificados de existencia y representación" tip="Personas que consultaron sobre Certificados." />
            <Card label="Trámites" value={tc['tramites'] || 0} sub="Trámites registrales en general" tip="Personas que preguntaron por trámites del registro mercantil." />
            <Card label="Renovaciones" value={tc['renovaciones'] || 0} sub="Renovación de matrícula mercantil" tip="Personas que consultaron sobre renovación de matrícula." />
            <Card label="Mutaciones" value={tc['mitaciones'] || 0} sub="Cambios de razón social, socios, etc." tip="Personas que consultaron sobre mutaciones del registro." />
          </CardGrid>
        </Section>

        {/* ════════ INFORMACIÓN GENERAL ════════ */}
        <Section label="Información General" icon="ℹ️">
          <CardGrid cols="repeat(auto-fit, minmax(200px, 1fr))">
            <Card label="Info General" value={tc['infogeneral'] || 0} sub="Horarios, dirección, servicios" tip="Personas que pidieron información general de la Cámara." />
            <Card label="Tu Negocio" value={tc['tunegocio'] || 0} sub="Programa Tu Negocio / apoyo empresarial" tip="Personas que preguntaron por el programa Tu Negocio." />
          </CardGrid>
        </Section>

        {/* ════════ RESUMEN ════════ */}
        <Section label="Resumen del Período" icon="📊">
          <CardGrid>
            <Card
              label="Total leads recibidos"
              value={metrics.totalLeads}
              sub="Conversaciones únicas iniciadas"
              tip="Total de personas que contactaron al bot en el período. Base de comparación de todos los demás números."
            />
            <Card
              label="Identificados por bot"
              value={totalTagCount}
              sub={`Suma de etiquetas asignadas`}
              tip="Puede superar el total de leads porque una persona puede tener varios tags si navegó por múltiples opciones del bot."
              variant="neutral"
            />
            <Card
              label="Sin atención humana"
              value={metrics.sinReplica}
              sub="No derivados a ningún flujo"
              tip="Leads nuevos del período que siguen sin entrar a ningún pipeline de atención. El bot respondió, pero ningún asesor les dio seguimiento."
              variant={metrics.sinReplica > metrics.totalLeads * 0.7 ? 'alert' : 'default'}
            />
            <Card
              label="En base de datos"
              value={metrics.totalInDB}
              sub="Total local (sincronización parcial)"
              tip="Leads en la base local. Kommo tiene ~28.000 en total; solo se han sincronizado los más recientes."
              variant="neutral"
            />
          </CardGrid>
        </Section>

      </div>

      {/* ── Pie ── */}
      <div style={{
        borderTop: `1px solid ${BORDER}`, padding: '12px 28px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 10, color: '#2a2a2a' }}>Cámara de Comercio de Soacha · Panel interno</span>
        <span style={{ fontSize: 10, color: '#2a2a2a' }}>Kommo CRM</span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
