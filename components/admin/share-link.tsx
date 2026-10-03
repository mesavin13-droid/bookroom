"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const t = document.createElement("textarea");
      t.value = value;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopied(true);
    toast.success("Скопировано");
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-1.5 pl-4">
      <span className="min-w-0 flex-1 truncate text-[0.9375rem] tabular" title={value}>
        {label ?? value}
      </span>
      <Button size="sm" onClick={copy} aria-label="Скопировать">
        {copied ? <Check /> : <Copy />} {copied ? "Готово" : "Копировать"}
      </Button>
    </div>
  );
}

export function ShareActions({ url, text }: { url: string; text: string }) {
  const [canShare, setCanShare] = React.useState(false);
  React.useEffect(() => setCanShare(typeof navigator !== "undefined" && "share" in navigator), []);
  const enc = encodeURIComponent;
  const links = [
    { label: "Telegram", href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}` },
    { label: "WhatsApp", href: `https://wa.me/?text=${enc(`${text} ${url}`)}` },
    { label: "ВКонтакте", href: `https://vk.com/share.php?url=${enc(url)}&title=${enc(text)}` },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {canShare && (
        <Button
          onClick={() => navigator.share({ title: text, text, url }).catch(() => undefined)}
        >
          <Share2 /> Поделиться
        </Button>
      )}
      {links.map((l) => (
        <Button key={l.label} asChild variant="outline">
          <a href={l.href} target="_blank" rel="noopener noreferrer">
            {l.label}
          </a>
        </Button>
      ))}
      <Button asChild variant="ghost">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink /> Открыть
        </a>
      </Button>
    </div>
  );
}
