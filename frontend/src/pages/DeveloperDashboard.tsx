import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  KeyRound, Copy, Check, Trash2, Plus, LogOut, Loader2, BookOpen, AlertCircle, Terminal,
} from 'lucide-react'
import { HackerCard } from '../components/ui/hacker-card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog'
import { useDevAuth } from '../contexts/DevAuthContext'
import { apiClient, type DevMe, type CreatedApiKey } from '../lib/api'

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-[#FB651E] transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export function DeveloperDashboard() {
  const { user, loading, logout } = useDevAuth()
  const queryClient = useQueryClient()
  const [newKey, setNewKey] = useState<CreatedApiKey | null>(null)
  const [keyName, setKeyName] = useState('')

  const { data: me, isLoading } = useQuery<DevMe>({
    queryKey: ['dev-me'],
    queryFn: () => apiClient.devMe().then((r) => r.data),
    enabled: !!user,
  })

  const createKey = useMutation({
    mutationFn: () => apiClient.createApiKey(keyName || undefined).then((r) => r.data),
    onSuccess: (data) => {
      setNewKey(data)
      setKeyName('')
      queryClient.invalidateQueries({ queryKey: ['dev-me'] })
    },
  })

  const revokeKey = useMutation({
    mutationFn: (id: number) => apiClient.revokeApiKey(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dev-me'] }),
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-[#FB651E]" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />

  const usage = me?.usage
  const pct = usage && usage.limit > 0 ? Math.min(100, Math.round((usage.used_24h / usage.limit) * 100)) : 0

  return (
    <>
      <Helmet><title>Developer Dashboard | ExploreYC API</title></Helmet>
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2 font-mono text-sm text-muted-foreground">
                <Terminal className="h-4 w-4 text-[#FB651E]" />
                <span>$ exploreyc --api</span>
              </div>
              <h1 className="text-3xl font-bold font-mono">
                <span className="text-[#FB651E]">&gt;</span> Developer Dashboard
              </h1>
              <p className="text-sm text-muted-foreground font-mono mt-1">{user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/api-docs"><Button variant="outline" className="font-mono"><BookOpen className="h-4 w-4 mr-2" />Docs</Button></Link>
              <Button variant="outline" className="font-mono" onClick={logout}><LogOut className="h-4 w-4 mr-2" />Logout</Button>
            </div>
          </div>

          {/* Plan + usage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <HackerCard glowColor="orange" className="p-6">
              <div className="text-sm font-mono text-muted-foreground mb-1">PLAN</div>
              <div className="text-2xl font-bold font-mono capitalize">{me?.plan_name || user.plan}</div>
              <p className="text-xs text-muted-foreground font-mono mt-2">
                {usage?.limit ?? user.daily_limit} requests / day
              </p>
              <a href="mailto:konstantin.borimechkov14@gmail.com?subject=ExploreYC%20API%20upgrade"
                 className="inline-block mt-3 text-xs text-[#FB651E] hover:underline font-mono">
                Need more? Contact us to upgrade →
              </a>
            </HackerCard>

            <HackerCard glowColor="green" className="p-6">
              <div className="text-sm font-mono text-muted-foreground mb-1">USAGE (LAST 24H)</div>
              <div className="text-2xl font-bold font-mono">
                {usage?.used_24h ?? 0}<span className="text-sm text-muted-foreground"> / {usage?.limit ?? user.daily_limit}</span>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className={`h-full ${pct >= 100 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-2">{usage?.remaining ?? '—'} remaining</p>
            </HackerCard>
          </div>

          {/* API keys */}
          <HackerCard glowColor="orange" className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold font-mono flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-[#FB651E]" /> API Keys
              </h2>
              <div className="flex items-center gap-2">
                <Input value={keyName} onChange={(e) => setKeyName(e.target.value)}
                       placeholder="Key name (optional)" className="font-mono h-9 w-48" />
                <Button className="bg-[#FB651E] hover:bg-[#E65C00]" disabled={createKey.isPending}
                        onClick={() => createKey.mutate()}>
                  {createKey.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" />New key</>}
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#FB651E]" /></div>
            ) : me && me.keys.length > 0 ? (
              <div className="divide-y divide-border">
                {me.keys.map((k) => (
                  <div key={k.id} className="flex items-center justify-between py-3 gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-sm truncate">
                        {k.key_prefix}<span className="text-muted-foreground">…</span>
                        {k.name && <span className="ml-2 text-muted-foreground">({k.name})</span>}
                        {!k.is_active && <span className="ml-2 text-xs text-red-500">revoked</span>}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        Created {new Date(k.created_at).toLocaleDateString()} ·{' '}
                        {k.last_used_at ? `last used ${new Date(k.last_used_at).toLocaleDateString()}` : 'never used'}
                      </div>
                    </div>
                    {k.is_active && (
                      <button onClick={() => revokeKey.mutate(k.id)} disabled={revokeKey.isPending}
                              className="inline-flex items-center gap-1 text-xs font-mono text-red-500 hover:text-red-600 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" /> Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground font-mono">
                No keys yet. Create one to start calling the API.
              </p>
            )}
          </HackerCard>
        </div>
      </div>

      {/* One-time key reveal */}
      <Dialog open={!!newKey} onOpenChange={(open) => !open && setNewKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-[#FB651E]" /> Your new API key</DialogTitle>
            <DialogDescription>
              Copy it now — for security we only store a hash and <strong>won't show it again</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 rounded-md border border-border bg-muted/50 p-3 font-mono text-sm break-all">
            {newKey?.api_key}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-mono">
              <AlertCircle className="h-4 w-4" /> Store it in a secret manager.
            </div>
            {newKey && <CopyButton value={newKey.api_key} />}
          </div>
          <Button className="mt-4 w-full bg-[#FB651E] hover:bg-[#E65C00]" onClick={() => setNewKey(null)}>
            I've saved my key
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
