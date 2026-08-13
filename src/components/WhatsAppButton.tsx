'use client';

import { useState } from 'react';
import { MessageCircle, Copy, Check, ExternalLink } from 'lucide-react';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { logWhatsAppAction } from '@/app/whatsappActions';

interface WhatsAppButtonProps {
  phone?: string | null;
  message: string;
  context: 'property' | 'client' | 'operation';
  resourceId: string;
}

export function WhatsAppButton({ phone, message, context, resourceId }: WhatsAppButtonProps) {
  const [copied, setCopied] = useState(false);

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
    if (!phone) {
      alert('El cliente no tiene un teléfono registrado.');
      return;
    }
    const link = buildWhatsAppLink(phone, message);
    window.open(link, '_blank');
    await logWhatsAppAction(resourceId, context, 'whatsapp_link_opened');
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-1.5 text-xs font-semibold text-[#25D366] transition hover:bg-[#25D366]/20"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? '¡Copiado!' : 'Copiar mensaje'}
      </button>
      <button
        onClick={handleOpenWhatsApp}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-1.5 text-xs font-semibold text-[#25D366] transition hover:bg-[#25D366]/20"
      >
        <MessageCircle className="h-4 w-4" />
        Abrir WhatsApp
        <ExternalLink className="h-3 w-3 ml-0.5 opacity-70" />
      </button>
    </div>
  );
}
