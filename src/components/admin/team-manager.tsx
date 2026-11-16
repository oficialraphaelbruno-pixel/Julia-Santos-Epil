"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Loader2, Lock, ShieldCheck, Unlock, UserPlus } from "lucide-react";
import { createPanelUserAction, setPermissionsAction, setUserPasswordAction } from "@/app/admin/actions/team";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AREAS, isAllowed, type Area, type Permissions } from "@/lib/permissions";

export interface TeamMember {
  userId: string;
  email: string;
  isPlatformAdmin: boolean;
  isMe: boolean;
  permissions: Permissions;
  lastSignIn: string | null;
}

export function TeamManager({ members }: { members: TeamMember[] }) {
  const [newOpen, setNewOpen] = useState(false);
  const [passwordFor, setPasswordFor] = useState<TeamMember | null>(null);

  return (
    <>
      <Button className="mb-5" onClick={() => setNewOpen(true)} data-testid="novo-login">
        <UserPlus /> Novo login
      </Button>
      <div className="space-y-5">
        {members.map((m) => (
          <div key={m.userId} className="card-premium p-5 sm:p-6" data-testid={`usuario-${m.email}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{m.email}</p>
                <p className="text-[13px] text-muted">{m.lastSignIn ? `Último acesso: ${m.lastSignIn}` : "Ainda não acessou"}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {m.isPlatformAdmin ? (
                  <Badge className="bg-amber-50 text-amber-800 ring-amber-200">
                    <ShieldCheck className="mr-1 size-3.5" /> Administrador geral
                  </Badge>
                ) : (
                  <Badge className="bg-sky-50 text-sky-800 ring-sky-200">Proprietária</Badge>
                )}
                <Button size="sm" variant="outline" onClick={() => setPasswordFor(m)} data-testid="alterar-senha">
                  <KeyRound /> {m.isMe ? "Alterar minha senha" : "Alterar senha"}
                </Button>
              </div>
            </div>
            {m.isPlatformAdmin ? (
              <p className="mt-4 rounded-2xl bg-ivory p-3 text-[13px] text-muted">Acesso total a todas as áreas, usuários e permissões.</p>
            ) : (
              <PermissionsEditor member={m} />
            )}
          </div>
        ))}
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent title="Novo login do painel" description="A pessoa entra em /admin/login com este e-mail e senha.">
          {newOpen ? <NewUserForm onDone={() => setNewOpen(false)} /> : null}
        </DialogContent>
      </Dialog>
      <Dialog open={passwordFor !== null} onOpenChange={(v) => !v && setPasswordFor(null)}>
        <DialogContent title="Alterar senha" description={passwordFor?.email}>
          {passwordFor ? <PasswordForm member={passwordFor} onDone={() => setPasswordFor(null)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PermissionsEditor({ member }: { member: TeamMember }) {
  const router = useRouter();
  const [perms, setPerms] = useState<Record<Area, boolean>>(
    () => Object.fromEntries(AREAS.map((a) => [a.key, isAllowed(member.permissions, a.key)])) as Record<Area, boolean>,
  );
  const [pending, start] = useTransition();
  const blockedCount = Object.values(perms).filter((v) => !v).length;

  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">O que esta pessoa pode editar</p>
        <span className="text-[12.5px] text-muted">{blockedCount ? `${blockedCount} área(s) bloqueada(s)` : "Tudo liberado"}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {AREAS.map((a) => (
          <label
            key={a.key}
            className="flex cursor-pointer items-start justify-between gap-3 rounded-2xl border border-line p-3"
            data-testid={`perm-${a.key}`}
          >
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                {perms[a.key] ? <Unlock className="size-3.5 text-emerald-700" /> : <Lock className="size-3.5 text-rose-700" />} {a.label}
              </span>
              <span className="mt-0.5 block text-[12px] leading-snug text-muted">{a.hint}</span>
            </span>
            <Switch checked={perms[a.key]} onCheckedChange={(v) => setPerms((p) => ({ ...p, [a.key]: v }))} aria-label={a.label} />
          </label>
        ))}
      </div>
      <p className="mt-3 text-[12.5px] text-muted">
        Sempre liberado: agenda, clientes, confirmação de sinal, pedidos de dados das clientes (LGPD) e a própria senha.
      </p>
      <div className="mt-3 flex justify-end">
        <Button
          disabled={pending}
          data-testid="salvar-permissoes"
          onClick={() =>
            start(async () => {
              const r = await setPermissionsAction({ userId: member.userId, permissions: perms });
              if (r.ok) {
                toast.success(r.message ?? "Salvo.");
                router.refresh();
              } else toast.error(r.error);
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : null} Salvar permissões
        </Button>
      </div>
    </div>
  );
}

function NewUserForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-4 overflow-y-auto px-6 py-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createPanelUserAction({ email, password, confirm });
          if (r.ok) {
            toast.success(r.message ?? "Login criado.");
            router.refresh();
            onDone();
          } else {
            setErrors(r.fieldErrors ?? {});
            toast.error(r.error);
          }
        });
      }}
    >
      <Field label="E-mail" htmlFor="nu-email" error={errors.email}>
        <Input id="nu-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Senha" htmlFor="nu-pass" error={errors.password} hint="Mínimo de 10 caracteres, com letras e números.">
        <Input id="nu-pass" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field label="Confirmar senha" htmlFor="nu-confirm" error={errors.confirm}>
        <Input id="nu-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      <p className="rounded-2xl bg-ivory p-3 text-[12.5px] text-muted">
        O novo login começa como proprietária com tudo liberado. Depois de criar, ajuste as permissões no cartão dele.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending} data-testid="criar-login">
          {pending ? <Loader2 className="animate-spin" /> : <UserPlus />} Criar login
        </Button>
      </div>
    </form>
  );
}

function PasswordForm({ member, onDone }: { member: TeamMember; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-4 overflow-y-auto px-6 py-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await setUserPasswordAction({ userId: member.userId, password, confirm });
          if (r.ok) {
            toast.success(r.message ?? "Senha alterada.");
            onDone();
          } else {
            setErrors(r.fieldErrors ?? {});
            toast.error(r.error);
          }
        });
      }}
    >
      <Field label="Nova senha" htmlFor="pw-new" error={errors.password} hint="Mínimo de 10 caracteres, com letras e números.">
        <Input id="pw-new" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field label="Confirmar nova senha" htmlFor="pw-confirm" error={errors.confirm}>
        <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending} data-testid="salvar-senha">
          {pending ? <Loader2 className="animate-spin" /> : <KeyRound />} Salvar nova senha
        </Button>
      </div>
    </form>
  );
}
