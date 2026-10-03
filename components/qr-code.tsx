"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { encodeQr, qrToSvg } from "@/lib/qr";

export function QrCode({ value, className, label = "QR-код" }: { value: string; className?: string; label?: string }) {
  const svg = React.useMemo(() => qrToSvg(encodeQr(value), { margin: 2 }), [value]);
  return <div role="img" aria-label={label} className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}

function download(name: string, href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function svgToPng(svg: string, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = size;
      c.height = Math.round((size * img.height) / img.width) || size;
      const g = c.getContext("2d");
      if (!g) return reject(new Error("canvas"));
      g.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** A4-ish poster for the reception desk: name, call to action, QR, short link. */
function posterSvg(value: string, title: string, caption: string) {
  const m = encodeQr(value);
  const n = m.length;
  const box = 420;
  const cell = box / n;
  let d = "";
  m.forEach((row, y) => row.forEach((c, x) => c && (d += `M${(x * cell).toFixed(2)} ${(y * cell).toFixed(2)}h${cell.toFixed(2)}v${cell.toFixed(2)}h-${cell.toFixed(2)}z`)));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" viewBox="0 0 595 842">
<rect width="595" height="842" fill="#ffffff"/>
<text x="297.5" y="110" font-family="Inter, Arial, sans-serif" font-size="40" font-weight="700" text-anchor="middle" fill="#0b0b0f">${esc(title)}</text>
<text x="297.5" y="160" font-family="Inter, Arial, sans-serif" font-size="22" text-anchor="middle" fill="#55565c">Онлайн-запись за минуту</text>
<g transform="translate(87.5 210)"><rect x="-16" y="-16" width="452" height="452" rx="28" fill="#f2f3f7"/><path d="${d}" fill="#0b0b0f"/></g>
<text x="297.5" y="720" font-family="Inter, Arial, sans-serif" font-size="22" text-anchor="middle" fill="#0b0b0f">Наведите камеру телефона на код</text>
<text x="297.5" y="760" font-family="Inter, Arial, sans-serif" font-size="18" text-anchor="middle" fill="#55565c">${esc(caption)}</text>
</svg>`;
}

export function QrDownloads({ value, name, slug }: { value: string; name: string; slug: string }) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const run = async (kind: "png" | "svg" | "poster") => {
    setBusy(kind);
    try {
      if (kind === "svg") {
        const svg = qrToSvg(encodeQr(value), { margin: 4 });
        download(`${slug}-qr.svg`, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      } else if (kind === "png") {
        download(`${slug}-qr.png`, await svgToPng(qrToSvg(encodeQr(value), { margin: 4 }), 1200));
      } else {
        download(`${slug}-poster.png`, await svgToPng(posterSvg(value, name, value.replace(/^https?:\/\//, "")), 1786));
      }
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => run("png")} loading={busy === "png"}>
        <Download /> QR в PNG
      </Button>
      <Button variant="outline" onClick={() => run("svg")} loading={busy === "svg"}>
        <Download /> QR в SVG
      </Button>
      <Button variant="outline" onClick={() => run("poster")} loading={busy === "poster"}>
        <Download /> Плакат на ресепшен
      </Button>
    </div>
  );
}
