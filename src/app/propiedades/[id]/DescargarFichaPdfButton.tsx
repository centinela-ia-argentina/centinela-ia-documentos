'use client';

import { FileDown } from 'lucide-react';

export function DescargarFichaPdfButton({
  name,
  propertyType,
  status,
  address,
  matricula,
  owners,
  surfaceTotal,
  surfaceCovered,
  rooms,
  gravamenes,
  notes,
  price,
  currency,
}: {
  name: string;
  propertyType: string;
  status: string;
  address: string | null;
  matricula: string | null;
  owners: string | null;
  surfaceTotal: number | null;
  surfaceCovered: number | null;
  rooms: number | null;
  gravamenes: string | null;
  notes: string | null;
  price: number | null;
  currency: string | null;
}) {
  const handleDescargar = () => {
    const escapeHtml = (unsafe: string) => {
      return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const row = (label: string, value: string | number | null) => {
      return `<tr><th>${label}</th><td>${value != null && value !== '' ? escapeHtml(String(value)) : '-'}</td></tr>`;
    };

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8" />
      <title>Ficha - ${escapeHtml(name)}</title>
      <style>
        * { font-family: Arial, sans-serif; box-sizing: border-box; }
        body { margin: 32px; color: #111; line-height: 1.4; }
        .header { margin-bottom: 24px; border-bottom: 1px solid #ccc; padding-bottom: 8px; }
        .header h1 { font-size: 14px; color: #555; text-transform: uppercase; margin: 0; letter-spacing: 1px; }
        .title { margin-bottom: 24px; }
        .title h2 { font-size: 24px; margin: 0 0 4px; color: #000; }
        .title p { font-size: 14px; margin: 0; color: #444; }
        .title .address { margin-top: 8px; font-size: 14px; color: #222; }
        
        .section { margin-bottom: 24px; }
        .section h3 { font-size: 16px; margin: 0 0 12px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
        
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
        th, td { border: 1px solid #eee; padding: 8px; text-align: left; vertical-align: top; }
        th { background: #fafafa; width: 30%; color: #555; font-weight: bold; }
        
        .price { font-size: 20px; font-weight: bold; color: #000; }
        .foot { margin-top: 40px; font-size: 10px; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 16px; }
        @media print { body { margin: 12mm; } }
      </style></head>
      <body>
        <div class="header">
          <h1>ANULUS AI — Ficha de Propiedad</h1>
        </div>
        
        <div class="title">
          <h2>${escapeHtml(name)}</h2>
          <p>${escapeHtml(propertyType)} · ${escapeHtml(status)}</p>
          ${address ? `<p class="address">📍 ${escapeHtml(address)}</p>` : ''}
        </div>

        <div class="section">
          <h3>Ficha técnica</h3>
          <table>
            <tbody>
              ${row('Matrícula / Catastro', matricula)}
              ${row('Titular(es)', owners)}
              ${row('Superficie total (m²)', surfaceTotal)}
              ${row('Sup. cubierta (m²)', surfaceCovered)}
              ${row('Ambientes', rooms)}
              ${row('Gravámenes / Inhibiciones', gravamenes)}
              ${row('Observaciones', notes)}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h3>Valor</h3>
          <p class="price">${price != null ? `${currency === 'USD' ? 'u$s' : '$'} ${price.toLocaleString('es-AR')}` : 'Consultar'}</p>
        </div>

        <p class="foot">Generado por Anulus AI · ${new Date().toLocaleString('es-AR')} · Beta operativa comercial</p>
      </body></html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Permití las ventanas emergentes para exportar el PDF.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    
    const cleanName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    win.document.title = `Ficha-${cleanName}.pdf`;
    
    setTimeout(() => {
      win.print();
    }, 300);
  };

  return (
    <div className="mb-6">
      <button
        onClick={handleDescargar}
        className="group relative inline-flex w-full justify-center items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-white/10 hover:border-white/20"
      >
        <FileDown className="h-4 w-4" />
        <span>📄 Descargar ficha en PDF</span>
      </button>
    </div>
  );
}
