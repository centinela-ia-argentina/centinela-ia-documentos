'use client';

import { useState } from 'react';
import { MessageCircle, Copy, Check, ExternalLink, Wand2 } from 'lucide-react';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { logWhatsAppAction } from '@/app/whatsappActions';
import approved from '@/components/approved/ApprovedDetail.module.css';
import recordStyles from '@/components/records/RecordWhatsApp.module.css';
import { ChatCircle, Copy as CopyIcon, Check as CheckIcon, MagicWand } from '@phosphor-icons/react';

interface WhatsAppIntentBuilderProps {
  phone?: string | null;
  defaultMessage: string;
  context: 'property' | 'client' | 'operation';
  resourceId: string;
  compact?: boolean;
  appearance?: 'default' | 'record';
}

export function WhatsAppIntentBuilder({ phone, defaultMessage, context, resourceId, compact = false, appearance = 'default' }: WhatsAppIntentBuilderProps) {
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleGenerate = () => {
    if (!isGenerated) setMessage(defaultMessage);
    setIsGenerated(true);
    setIsExpanded(true);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      await logWhatsAppAction(resourceId, context, 'whatsapp_message_generated');
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  const handleOpenWhatsApp = async () => {
    const link = phone ? buildWhatsAppLink(phone, message) : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(link, '_blank');
    await logWhatsAppAction(resourceId, context, 'whatsapp_link_opened');
  };

  const record = appearance === 'record' && !compact;
  return (
    <div className={record ? recordStyles.root : compact ? 'w-full' : 'rounded-2xl border border-white/10 bg-white/5 p-4'}>
      {!compact && <div className={record ? recordStyles.header : "flex items-center gap-2 mb-3 text-[#25D366]"}>
        {record ? <ChatCircle size={20} aria-hidden="true" /> : <MessageCircle className="h-5 w-5" />}
        <h4 className={record ? undefined : "font-semibold text-white"}>WhatsApp</h4>
      </div>}

      {!isGenerated || (compact && !isExpanded) ? (
        <button
          onClick={handleGenerate}
          className={record ? recordStyles.action : compact ? approved.action : 'flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20'}
        >
          {record ? <MagicWand size={16} aria-hidden="true" /> : compact ? <MessageCircle className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
          {compact ? 'Preparar mensaje' : 'Generar mensaje'}
        </button>
      ) : (
        <div className={record ? recordStyles.editor : "space-y-3"}>
          {compact && <div className="flex flex-wrap items-center justify-between gap-3"><div><h3>Mensaje para revisar</h3><p className="text-sm">Plantilla editable, sin IA. Revisá el texto antes de usarlo.</p></div><button type="button" className={approved.action} onClick={() => setIsExpanded(false)}>Cerrar mensaje</button></div>}
          {record && <p className={recordStyles.hint}>Plantilla editable, sin IA. Revisá el texto antes de usarlo.</p>}
          <textarea
            aria-label="Mensaje para revisar"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className={record ? recordStyles.message : compact ? 'w-full min-h-36 rounded-md border border-neutral-400 bg-white p-3 text-sm text-neutral-800 focus:outline-2 focus:outline-slate-600' : 'w-full resize-none rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300 outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366]'}
          />
          <div className={record ? recordStyles.actions : "flex flex-wrap gap-2"}>
            <button
              onClick={handleCopy}
              className={record ? recordStyles.action : compact ? approved.action : 'flex-1 inline-flex justify-center items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20'}
            >
              {record ? copied ? <CheckIcon size={16} aria-hidden="true" /> : <CopyIcon size={16} aria-hidden="true" /> : copied ? <Check className="h-4 w-4 text-[#25D366]" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
            <button
              onClick={handleOpenWhatsApp}
              className={record ? recordStyles.action : compact ? approved.action : 'flex-1 inline-flex justify-center items-center gap-1.5 rounded-xl bg-[#25D366]/20 border border-[#25D366]/30 px-3 py-2 text-xs font-semibold text-[#25D366] transition hover:bg-[#25D366]/30'}
            >
              {record ? <ChatCircle size={16} aria-hidden="true" /> : <MessageCircle className="h-4 w-4" />}
              Abrir WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
