'use client';

import { useState } from 'react';
import { MessageCircle, Copy, Check, ExternalLink, Wand2 } from 'lucide-react';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { logWhatsAppAction } from '@/app/whatsappActions';

interface WhatsAppIntentBuilderProps {
  phone?: string | null;
  defaultMessage: string;
  context: 'property' | 'client' | 'operation';
  resourceId: string;
}

export function WhatsAppIntentBuilder({ phone, defaultMessage, context, resourceId }: WhatsAppIntentBuilderProps) {
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);

  const handleGenerate = () => {
    setMessage(defaultMessage);
    setIsGenerated(true);
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

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 mb-3 text-[#25D366]">
        <MessageCircle className="h-5 w-5" />
        <h4 className="font-semibold text-white">WhatsApp</h4>
      </div>

      {!isGenerated ? (
        <button
          onClick={handleGenerate}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
        >
          <Wand2 className="h-4 w-4" />
          Generar mensaje
        </button>
      ) : (
        <div className="space-y-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="w-full resize-none rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300 outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366]"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 inline-flex justify-center items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              {copied ? <Check className="h-4 w-4 text-[#25D366]" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
            <button
              onClick={handleOpenWhatsApp}
              className="flex-1 inline-flex justify-center items-center gap-1.5 rounded-xl bg-[#25D366]/20 border border-[#25D366]/30 px-3 py-2 text-xs font-semibold text-[#25D366] transition hover:bg-[#25D366]/30"
            >
              <MessageCircle className="h-4 w-4" />
              Abrir WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
