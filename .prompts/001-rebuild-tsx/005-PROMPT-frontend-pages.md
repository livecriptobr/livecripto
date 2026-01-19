# Prompt: Criar Páginas Frontend

## Objetivo
Criar todas as páginas do frontend (doação, overlay, dashboard).

## Instruções

### 1. Página de Doação `src/app/(public)/[username]/page.tsx`

```tsx
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { DonationForm } from "@/components/donate/DonationForm";

export default async function DonatePage({ params }: { params: { username: string } }) {
  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("username", params.username)
    .single();

  if (!profile) notFound();

  return (
    <div className="min-h-screen bg-[#0b0b0f] flex items-center justify-center p-6">
      <DonationForm username={params.username} />
    </div>
  );
}
```

### 2. Componente DonationForm `src/components/donate/DonationForm.tsx`

```tsx
"use client";

import { useState } from "react";

interface Props {
  username: string;
}

type AssetOption = { asset: string; chain: string; label: string };

const CRYPTO_OPTIONS: AssetOption[] = [
  { asset: "BTC", chain: "lightning", label: "Bitcoin Lightning ⚡" },
  { asset: "BTC", chain: "bitcoin", label: "Bitcoin (BTC)" },
  { asset: "ETH", chain: "ethereum", label: "Ethereum (ETH)" },
  { asset: "USDT", chain: "ethereum", label: "USDT (ERC20)" },
  { asset: "BNB", chain: "bsc", label: "BNB (BSC)" },
];

export function DonationForm({ username }: Props) {
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [payerName, setPayerName] = useState("");
  const [showCrypto, setShowCrypto] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const getAmountNumber = () => {
    const val = amount.replace(",", ".");
    const num = parseFloat(val);
    return isNaN(num) || num <= 0 ? null : num;
  };

  const handlePayment = async (asset: string, chain?: string) => {
    const amountNum = getAmountNumber();
    if (!amountNum) {
      setError("Por favor, insira um valor válido.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          amount: amountNum,
          message,
          payer_name: payerName || "Anônimo",
          asset,
          chain,
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      window.location.href = data.checkoutLink;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTest = async () => {
    const amountNum = getAmountNumber();
    if (!amountNum) {
      setError("Por favor, insira um valor para o teste.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/donate/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          amount: amountNum,
          message,
          payer_name: payerName || "Anônimo Teste",
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      setError("");
      alert("Doação de teste enviada com sucesso!");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-[#12121a] border border-[#1f1f2a] rounded-2xl p-7">
      <h1 className="text-2xl font-bold text-center bg-gradient-to-r from-purple-500 to-violet-600 bg-clip-text text-transparent mb-6">
        Enviar doação para {username}
      </h1>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-400">Seu Nome (Opcional)</label>
          <input
            type="text"
            value={payerName}
            onChange={(e) => setPayerName(e.target.value)}
            placeholder="Anônimo"
            className="w-full mt-1 px-4 py-3 bg-[#0e0e16] border border-[#232332] rounded-xl text-white focus:border-purple-500 outline-none"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400">Valor (BRL)</label>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="10,00"
            className="w-full mt-1 px-4 py-3 bg-[#0e0e16] border border-[#232332] rounded-xl text-white focus:border-purple-500 outline-none"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400">Mensagem</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Sua mensagem de apoio!"
            rows={3}
            className="w-full mt-1 px-4 py-3 bg-[#0e0e16] border border-[#232332] rounded-xl text-white focus:border-purple-500 outline-none resize-none"
          />
        </div>
      </div>

      {!showCrypto ? (
        <div className="mt-6 space-y-3">
          <button
            onClick={() => handlePayment("PIX")}
            disabled={isLoading}
            className="w-full py-3 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
          >
            {isLoading ? "Gerando..." : "Pagar com Pix"}
          </button>

          <button
            onClick={() => setShowCrypto(true)}
            className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-purple-500 to-violet-600 text-white"
          >
            Pagar com Cripto
          </button>

          <button
            onClick={handleTest}
            disabled={isLoading}
            className="w-full py-3 rounded-xl font-bold bg-gray-600 hover:bg-gray-700 text-white disabled:opacity-50"
          >
            ★ Doação Teste ★
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          <p className="text-center text-sm text-gray-400 mb-3">Escolha a moeda:</p>

          {CRYPTO_OPTIONS.map((opt) => (
            <button
              key={`${opt.asset}-${opt.chain}`}
              onClick={() => handlePayment(opt.asset, opt.chain)}
              disabled={isLoading}
              className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-purple-500 to-violet-600 text-white disabled:opacity-50"
            >
              {opt.label}
            </button>
          ))}

          <button
            onClick={() => setShowCrypto(false)}
            className="w-full py-3 rounded-xl font-bold bg-gray-700 text-gray-300 mt-2"
          >
            Voltar
          </button>
        </div>
      )}

      {error && <p className="mt-4 text-red-400 text-sm text-center">{error}</p>}
    </div>
  );
}
```

### 3. Overlay `src/app/(public)/overlay/[username]/page.tsx`

```tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface Donation {
  id: string;
  donor_name: string;
  amount_brl: number;
  message: string;
  audio_url?: string;
  status: string;
  played_in_overlay: boolean;
}

export default function OverlayPage({ params }: { params: { username: string } }) {
  const [queue, setQueue] = useState<Donation[]>([]);
  const [currentAlert, setCurrentAlert] = useState<Donation | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const supabase = createClient();

  useEffect(() => {
    const init = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", params.username)
        .single();

      if (!profile) return;

      const channel = supabase
        .channel(`overlay-${profile.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "donations", filter: `user_id=eq.${profile.id}` },
          (payload) => {
            const d = payload.new as Donation;
            if (d.status === "complete" && !d.played_in_overlay) {
              setQueue((prev) => [...prev, d]);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    init();
  }, [params.username, supabase]);

  useEffect(() => {
    if (currentAlert || queue.length === 0) return;

    const next = queue[0];
    setQueue((prev) => prev.slice(1));
    setCurrentAlert(next);

    if (next.audio_url && audioRef.current) {
      audioRef.current.src = next.audio_url;
      audioRef.current.play().catch(console.error);
    } else {
      setTimeout(() => finishAlert(next.id), 6000);
    }
  }, [queue, currentAlert]);

  const finishAlert = async (id: string) => {
    await supabase.from("donations").update({ played_in_overlay: true }).eq("id", id);
    setCurrentAlert(null);
  };

  if (!currentAlert) return null;

  const texto = `${currentAlert.donor_name} mandou R$ ${currentAlert.amount_brl.toFixed(2).replace(".", ",")}: ${currentAlert.message}`;

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center">
      <div
        className="bg-[#12121a]/95 border-2 border-purple-500 rounded-2xl p-6 max-w-xl text-center shadow-[0_0_50px_rgba(168,85,247,0.4)] animate-[popIn_0.5s_ease-out]"
      >
        <p className="text-xl text-white font-medium">{texto}</p>
      </div>

      <audio
        ref={audioRef}
        onEnded={() => currentAlert && finishAlert(currentAlert.id)}
      />

      <style jsx>{`
        @keyframes popIn {
          from {
            transform: scale(0.8);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
```

### 4. Dashboard Layout `src/app/(dashboard)/layout.tsx`

```tsx
import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = auth();
  if (!userId) redirect("/login");

  return (
    <div className="min-h-screen bg-[#0b0b0f] grid grid-cols-1 md:grid-cols-[240px_1fr]">
      <Sidebar />
      <main className="p-6">{children}</main>
    </div>
  );
}
```

### 5. Sidebar `src/components/dashboard/Sidebar.tsx`

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

const NAV_ITEMS = [
  { href: "/panel", label: "📈 Dashboard" },
  { href: "/wallet", label: "💼 Carteira" },
  { href: "/widgets", label: "🧩 Widgets" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="border-r border-[#1f1f2a] bg-gradient-to-b from-[#0b0b0f] to-[#0a0a12] hidden md:block">
      <div className="flex items-center gap-3 p-5">
        <div className="w-4 h-4 rounded bg-gradient-to-br from-purple-500 to-violet-600" />
        <span className="font-bold text-white">LiveCripto</span>
      </div>

      <nav className="p-2 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-gray-300 border transition ${
              pathname === item.href
                ? "bg-[#151528] border-[#25253a]"
                : "border-[#171724] bg-[#12121a] hover:bg-[#151528]"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="absolute bottom-4 left-4">
        <UserButton afterSignOutUrl="/login" />
      </div>
    </aside>
  );
}
```

### 6. Dashboard Page `src/app/(dashboard)/panel/page.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { createClient } from "@/lib/supabase/client";

interface Donation {
  id: string;
  donor_name: string;
  amount_brl: number;
  message: string;
  status: string;
  created_at: string;
}

export default function PanelPage() {
  const { getToken } = useAuth();
  const [stats, setStats] = useState({ messages: 0, amountBRL: 0 });
  const [donations, setDonations] = useState<Donation[]>([]);
  const supabase = createClient();

  useEffect(() => {
    const loadStats = async () => {
      const token = await getToken();
      const res = await fetch("/api/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) setStats(data);
    };

    loadStats();
  }, [getToken]);

  return (
    <div>
      <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-violet-600 bg-clip-text text-transparent mb-2">
        Dashboard
      </h1>
      <p className="text-gray-400 mb-6">Bem-vindo de volta</p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[#12121a] border border-[#1f1f2a] rounded-2xl p-4">
          <p className="text-xs text-gray-400">Mensagens (7 dias)</p>
          <p className="text-2xl font-bold">{stats.messages}</p>
        </div>
        <div className="bg-[#12121a] border border-[#1f1f2a] rounded-2xl p-4">
          <p className="text-xs text-gray-400">Recebido (R$)</p>
          <p className="text-2xl font-bold">R$ {stats.amountBRL.toFixed(2).replace(".", ",")}</p>
        </div>
      </div>

      <div className="bg-[#12121a] border border-[#1f1f2a] rounded-2xl p-4">
        <p className="text-xs text-gray-400 mb-3">Últimas Doações</p>
        <div className="space-y-2">
          {donations.length === 0 && <p className="text-gray-500">Nenhuma doação ainda.</p>}
          {donations.map((d) => (
            <div key={d.id} className="border border-[#232332] rounded-lg p-3">
              <div className="flex justify-between text-sm">
                <strong>{d.donor_name}</strong>
                <span className={d.status === "complete" ? "text-emerald-400" : "text-yellow-400"}>
                  {d.status}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{d.message}</p>
              <p className="font-bold mt-1">R$ {d.amount_brl.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 7. Wallet Page `src/app/(dashboard)/wallet/page.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

export default function WalletPage() {
  const { getToken } = useAuth();
  const [warpayKey, setWarpayKey] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const token = await getToken();
      const res = await fetch("/api/wallet", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) setWarpayKey(data.warpay_apikey || "");
    };
    load();
  }, [getToken]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage("");

    const token = await getToken();
    const res = await fetch("/api/wallet", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ warpay_apikey: warpayKey }),
    });

    const data = await res.json();
    setMessage(data.ok ? "Chave salva com sucesso!" : "Erro ao salvar.");
    setIsSaving(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-violet-600 bg-clip-text text-transparent mb-6">
        Carteira
      </h1>

      <div className="bg-[#12121a] border border-[#1f1f2a] rounded-2xl p-6 max-w-lg">
        <h3 className="font-bold mb-2">Configurar Chave WarPay</h3>
        <p className="text-sm text-gray-400 mb-4">
          Informe sua chave da API WarPay para recebimento via cripto.
        </p>

        <label className="text-xs text-gray-400">Chave da API</label>
        <input
          type="text"
          value={warpayKey}
          onChange={(e) => setWarpayKey(e.target.value)}
          placeholder="Informe sua chave aqui..."
          className="w-full mt-1 mb-4 px-4 py-3 bg-[#0e0e16] border border-[#232332] rounded-xl text-white focus:border-purple-500 outline-none"
        />

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-3 rounded-xl font-bold bg-gradient-to-r from-purple-500 to-violet-600 text-white disabled:opacity-50"
        >
          {isSaving ? "Salvando..." : "Salvar Chave"}
        </button>

        {message && (
          <p className={`mt-3 text-sm ${message.includes("sucesso") ? "text-emerald-400" : "text-red-400"}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
```

### 8. Widgets Page `src/app/(dashboard)/widgets/page.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

export default function WidgetsPage() {
  const { getToken } = useAuth();
  const [overlayLink, setOverlayLink] = useState("");
  const [donorLink, setDonorLink] = useState("");

  useEffect(() => {
    const load = async () => {
      const token = await getToken();
      const res = await fetch("/api/overlays", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setOverlayLink(data.overlays.overlay);
        setDonorLink(data.overlays.donorPage);
      }
    };
    load();
  }, [getToken]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copiado!");
  };

  return (
    <div>
      <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-violet-600 bg-clip-text text-transparent mb-6">
        Widgets
      </h1>

      <div className="bg-[#12121a] border border-[#1f1f2a] rounded-2xl p-6 max-w-lg">
        <p className="text-xs text-gray-400 mb-4">Seus links</p>

        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              readOnly
              value={overlayLink}
              className="flex-1 px-4 py-3 bg-[#0e0e16] border border-[#232332] rounded-xl text-white"
            />
            <button
              onClick={() => copyToClipboard(overlayLink)}
              className="px-4 py-3 rounded-xl font-bold bg-gradient-to-r from-purple-500 to-violet-600 text-white"
            >
              Copiar
            </button>
          </div>

          <div className="flex gap-2">
            <input
              readOnly
              value={donorLink}
              className="flex-1 px-4 py-3 bg-[#0e0e16] border border-[#232332] rounded-xl text-white"
            />
            <button
              onClick={() => copyToClipboard(donorLink)}
              className="px-4 py-3 rounded-xl font-bold bg-gradient-to-r from-purple-500 to-violet-600 text-white"
            >
              Copiar
            </button>
          </div>
        </div>

        <p className="mt-4 px-3 py-2 bg-[#141422] border border-[#2a2a3a] rounded-full text-xs text-gray-400 inline-block">
          Abra o overlay no OBS (Browser Source) e deixe aberto.
        </p>
      </div>
    </div>
  );
}
```

### 9. Auth Pages

`src/app/(auth)/login/[[...login]]/page.tsx`:
```tsx
import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0b0b0f] flex items-center justify-center">
      <SignIn afterSignInUrl="/panel" />
    </div>
  );
}
```

`src/app/(auth)/cadastro/[[...cadastro]]/page.tsx`:
```tsx
import { SignUp } from "@clerk/nextjs";

export default function CadastroPage() {
  return (
    <div className="min-h-screen bg-[#0b0b0f] flex items-center justify-center">
      <SignUp afterSignUpUrl="/panel" />
    </div>
  );
}
```

## Output Esperado
- Todas as páginas funcionando
- Doação, overlay e dashboard operacionais
