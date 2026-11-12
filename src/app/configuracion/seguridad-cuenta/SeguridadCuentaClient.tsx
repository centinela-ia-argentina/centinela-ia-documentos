'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MotionCard } from '@/components/ui/MotionCard';
import { Shield } from 'lucide-react';

export function SeguridadCuentaClient() {
  const supabase = createClient();
  const [estado, setEstado] = useState<'cargando' | 'activo' | 'inactivo' | 'desconocido'>('cargando');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function refrescar() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      // Un fallo de consulta no se presenta como "inactivo": el estado queda desconocido.
      setEstado('desconocido');
      return;
    }
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
    if (factorId) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) {
        setMsg('No se pudo cancelar la configuración pendiente. Reintentá desde la pantalla; el factor verificado no fue afectado.');
        setCargando(false);
        return;
      }
    }
    setQr(null); setSecret(null); setFactorId(null); setCode(''); setMsg('Configuración pendiente cancelada. El estado de los factores verificados no cambió.');
  }

  async function desactivar() {
    setCargando(true); setMsg(null);
    const { data, error: listError } = await supabase.auth.mfa.listFactors();

    if (listError) {
      setMsg('No se pudo confirmar el estado de los factores. La desactivación no se declara completa; revisá el estado antes de reintentar.');
      setCargando(false);
      return;
    }

    let falloRetiro = false;
    for (const f of (data?.totp ?? [])) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
      if (error) falloRetiro = true;
    }

    await refrescar();

    // La desactivación solo se anuncia como completa si el re consultedo confirma
    // que ya no queda ningún factor verificado.
    const { data: verificacion } = await supabase.auth.mfa.listFactors();
    const quedanVerificados = (verificacion?.totp ?? []).some((f) => f.status === 'verified');

    if (falloRetiro || quedanVerificados) {
      setMsg('No se pudo confirmar la desactivación completa. Revisá el estado actual de la verificación en dos pasos antes de reintentar.');
    } else {
      setMsg('2FA desactivado.');
    }
    setCargando(false);
  }

  return (
    <div className="space-y-6">
      <MotionCard index={0} className="rounded-xl border border-[#e3e4e5] bg-white p-6 transition-colors hover:border-[#cfd3d2]">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#eceeed] bg-[#fcfcfc] text-[#50565d]">
            <Shield size={20} />
          </div>
          <div>
            <h3 className="text-[15.5px] font-bold text-[#25272a]">Seguridad de la cuenta</h3>
            <p className="mt-0.5 text-[13px] text-[#6b7075]">Verificación en dos pasos (2FA) con app autenticadora.</p>
          </div>
        </div>

        {estado === 'cargando' && (
          <p className="text-[13px] text-[#6b7075]">Cargando estado de seguridad…</p>
        )}

        {estado === 'activo' && (
          <div className="flex items-center justify-between gap-4 border-t border-[#eceeed] pt-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              2FA activado
            </div>
            <div>
              <button
                onClick={desactivar}
                disabled={cargando}
                className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-[12.5px] font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
              >
                Desactivar 2FA
              </button>
            </div>
          </div>
        )}

        {estado === 'desconocido' && !qr && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800" role="alert">
            No se pudo confirmar el estado de la verificación en dos pasos. El estado no se presenta como desactivado; revisá tu conexión e ingresá nuevamente para confirmarlo.
          </div>
        )}

        {estado === 'inactivo' && !qr && (
          <div className="border-t border-[#eceeed] pt-4">
            <button
              onClick={activar}
              disabled={cargando}
              className="rounded-lg bg-[#25272a] px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-[#3a3d41] disabled:opacity-50"
            >
              Activar 2FA
            </button>
          </div>
        )}

        {qr && (
          <div className="mt-4 space-y-4 rounded-xl border border-[#eceeed] bg-[#fcfcfc] p-6">
            <p className="text-[13px] text-[#50565d]">
              Escaneá el QR con Google Authenticator o Authy y escribí el código de 6 dígitos.
            </p>
            <div className="w-fit rounded-lg border border-[#e3e4e5] bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Código QR 2FA" width={180} height={180} />
            </div>
            {secret && (
              <p className="max-w-[200px] break-all font-mono text-[11px] text-[#6b7075]">
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
                className="w-full rounded-lg border border-[#e3e4e5] bg-white px-4 py-2.5 text-center tracking-widest text-[13.5px] text-[#25272a] outline-none focus:border-[#25272a] focus:ring-1 focus:ring-[#25272a]/20"
              />
              <div className="flex gap-2">
                <button
                  onClick={cancelar}
                  disabled={cargando}
                  className="flex-1 rounded-lg border border-[#e3e4e5] bg-white px-4 py-2 text-[12.5px] font-bold text-[#25272a] transition hover:bg-[#f3f4f4] disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={verificar}
                  disabled={cargando || code.length !== 6}
                  className="flex-1 rounded-lg bg-[#25272a] px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-[#3a3d41] disabled:opacity-50"
                >
                  Verificar
                </button>
              </div>
            </div>
          </div>
        )}

        {msg && (
          <p className={`mt-4 text-[13px] font-semibold ${msg.includes('éxito') ? 'text-emerald-700' : 'text-amber-800'}`}>
            {msg}
          </p>
        )}
      </MotionCard>
    </div>
  );
}
