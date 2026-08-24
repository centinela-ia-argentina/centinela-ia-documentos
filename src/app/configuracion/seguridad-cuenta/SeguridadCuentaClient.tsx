'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MotionCard } from '@/components/ui/MotionCard';
import { Shield } from 'lucide-react';

export function SeguridadCuentaClient() {
  const supabase = createClient();
  const [estado, setEstado] = useState<'cargando' | 'activo' | 'inactivo'>('cargando');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function refrescar() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) { setEstado('inactivo'); return; }
    const verificado = (data?.totp ?? []).some((f) => f.status === 'verified');
    setEstado(verificado ? 'activo' : 'inactivo');
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { refrescar(); }, []);

  async function activar() {
    setCargando(true); setMsg(null);
    // limpiar cualquier factor a medio activar
    const { data: fdata } = await supabase.auth.mfa.listFactors();
    for (const f of (fdata?.all ?? [])) {
      if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (error || !data) { setMsg('No se pudo iniciar la activación: ' + (error?.message ?? '')); setCargando(false); return; }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
    setCargando(false);
  }

  async function verificar() {
    if (!factorId) return;
    setCargando(true); setMsg(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (error) { setMsg('Código incorrecto o vencido. Revisá la app y probá de nuevo.'); setCargando(false); return; }
    setQr(null); setSecret(null); setFactorId(null); setCode('');
    setMsg('¡2FA activado con éxito!');
    await refrescar();
    setCargando(false);
  }

  async function cancelar() {
    if (factorId) await supabase.auth.mfa.unenroll({ factorId });
    setQr(null); setSecret(null); setFactorId(null); setCode(''); setMsg(null);
  }

  async function desactivar() {
    setCargando(true); setMsg(null);
    const { data } = await supabase.auth.mfa.listFactors();
    for (const f of (data?.totp ?? [])) await supabase.auth.mfa.unenroll({ factorId: f.id });
    await refrescar();
    setMsg('2FA desactivado.');
    setCargando(false);
  }

  return (
    <div className="space-y-6">
      <MotionCard index={0} className="border border-white/10 bg-white/[0.03] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_16px_40px_-16px_rgba(0,0,0,0.7)] transition-colors hover:border-accent/40">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-accent">
            <Shield size={20} />
          </div>
          <div>
            <h3 className="font-display text-xl font-semibold text-white">Seguridad de la cuenta</h3>
            <p className="mt-1 text-sm text-slate-400">Verificación en dos pasos (2FA) con app autenticadora.</p>
          </div>
        </div>

        {estado === 'cargando' && (
          <p className="text-sm text-slate-400">Cargando estado de seguridad…</p>
        )}

        {estado === 'activo' && (
          <div className="space-y-4 border-t border-white/10 pt-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              2FA activado
            </div>
            <div>
              <button
                onClick={desactivar}
                disabled={cargando}
                className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-50"
              >
                Desactivar 2FA
              </button>
            </div>
          </div>
        )}

        {estado === 'inactivo' && !qr && (
          <div className="border-t border-white/10 pt-4">
            <button
              onClick={activar}
              disabled={cargando}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50"
            >
              Activar 2FA
            </button>
          </div>
        )}

        {qr && (
          <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-6 mt-4">
            <p className="text-sm text-slate-300">
              Escaneá el QR con Google Authenticator o Authy y escribí el código de 6 dígitos.
            </p>
            <div className="rounded-xl bg-white p-2 w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Código QR 2FA" width={180} height={180} />
            </div>
            {secret && (
              <p className="text-[11px] font-mono text-slate-500 break-all max-w-[200px]">
                Secret: {secret}
              </p>
            )}
            <div className="max-w-[240px] space-y-4">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full text-center tracking-widest rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              />
              <div className="flex gap-2">
                <button
                  onClick={cancelar}
                  disabled={cargando}
                  className="flex-1 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={verificar}
                  disabled={cargando || code.length !== 6}
                  className="flex-1 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50"
                >
                  Verificar
                </button>
              </div>
            </div>
          </div>
        )}

        {msg && (
          <p className={`mt-4 text-sm ${msg.includes('éxito') ? 'text-emerald-400' : 'text-amber-400'}`}>
            {msg}
          </p>
        )}
      </MotionCard>
    </div>
  );
}
