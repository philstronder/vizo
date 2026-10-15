"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Download, QrCode } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/I18nProvider";

// The QR code points at /tv/<id>, which opens the store in store mode.
// NEXT_PUBLIC_APP_URL pins the public origin so a code generated from a
// staging or local admin session still points viewers at production.
export function storeQrUrl(storeId: string) {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
  return `${origin.replace(/\/$/, "")}/tv/${storeId}`;
}

export function StoreQrCode({ storeId, storeName }: { storeId: string; storeName: string }) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const url = storeQrUrl(storeId);

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `vizo-qr-${storeName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
    a.click();
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardBody>
        <h2 className="mb-1 flex items-center gap-1.5 font-bold text-ink">
          <QrCode size={16} /> {t.store.qrTitle}
        </h2>
        <p className="mb-4 text-xs text-ink-400">{t.store.qrHint}</p>
        <div className="mb-3 flex justify-center rounded-xl bg-white p-4">
          {/* Rendered at broadcast resolution, displayed scaled down. */}
          <QRCodeCanvas
            ref={canvasRef}
            value={url}
            size={1024}
            marginSize={2}
            level="M"
            style={{ width: 200, height: 200 }}
          />
        </div>
        <p className="mb-3 break-all text-center text-xs text-ink-400">{url}</p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" fullWidth onClick={handleCopy}>
            <Copy size={14} /> {copied ? t.store.copied : t.store.copyLink}
          </Button>
          <Button size="sm" fullWidth onClick={handleDownload}>
            <Download size={14} /> {t.store.downloadQr}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
