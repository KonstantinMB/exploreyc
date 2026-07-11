import { useState, type ChangeEvent } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  KeyRound, Copy, Check, Trash2, Plus, LogOut, Loader2, BookOpen, AlertCircle, Terminal, Activity, Camera,
} from 'lucide-react'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { HackerCard } from '../components/ui/hacker-card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog'
import { Avatar } from '../components/ui/Avatar'
import { useDevAuth } from '../contexts/DevAuthContext'
import { apiClient, type DevMe, type CreatedApiKey, type UsageStats } from '../lib/api'

/** Resize an uploaded image to a small square jpeg data URL (avoids file storage). */
function resizeToDataUrl(file: File, size = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('no canvas'))
        const scale = Math.max(size / img.width, size / img.height)
        const w = img.width * scale
        const h = img.height * scale
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

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
  const { user, loading, logout, refresh } = useDevAuth()
  const queryClient = useQueryClient()
  const [newKey, setNewKey] = useState<CreatedApiKey | null>(null)
  const [keyName, setKeyName] = useState('')
  const [company, setCompany] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState('')

  const { data: me, isLoading } = useQuery<DevMe>({
    queryKey: ['dev-me'],
    queryFn: () => apiClient.devMe().then((r) => r.data),
    enabled: !!user,
  })

  const { data: usageStats } = useQuery<UsageStats>({
    queryKey: ['dev-usage'],
    queryFn: () => apiClient.devUsage(7).then((r) => r.data),
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

  const profile = useMutation({
    mutationFn: (data: { company_name?: string; avatar_url?: string }) => apiClient.updateProfile(data),
    onSuccess: () => { refresh(); queryClient.invalidateQueries({ queryKey: ['dev-me'] }) },
  })

  const onPickAvatar = async (e: ChangeEvent<HTMLInputElement>) => {
    setAvatarError('')
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const avatar_url = await resizeToDataUrl(file)
      profile.mutate({ avatar_url })
    } catch {
      setAvatarError('Could not process that image.')
    }
  }

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

          {/* Profile */}
          <HackerCard glowColor="orange" className="p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="relative flex-shrink-0">
                <Avatar src={me?.avatar_url ?? user.avatar_url} name={(me?.company_name || user.company_name) ?? user.email} size={64} />
                <label className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#FB651E] hover:bg-[#E65C00] rounded-full flex items-center justify-center cursor-pointer border-2 border-background"
                       title="Upload a picture">
                  {profile.isPending ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Camera className="w-3.5 h-3.5 text-white" />}
                  <input type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
                </label>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-mono text-muted-foreground mb-2 truncate">{user.email}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={company ?? (me?.company_name ?? user.company_name ?? '')}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Company name"
                    className="h-9 font-mono max-w-xs"
                  />
                  <Button
                    className="bg-[#FB651E] hover:bg-[#E65C00] h-9"
                    disabled={profile.isPending || company === null}
                    onClick={() => profile.mutate({ company_name: company ?? '' })}
                  >
                    Save
                  </Button>
                  {(me?.avatar_url ?? user.avatar_url) && (
                    <button
                      onClick={() => profile.mutate({ avatar_url: '' })}
                      className="text-xs font-mono text-muted-foreground hover:text-red-500"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
                {avatarError && <p className="text-xs text-red-500 mt-1">{avatarError}</p>}
              </div>
            </div>
          </HackerCard>

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

          {/* Usage — last 7 days */}
          <HackerCard glowColor="blue" className="p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold font-mono flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-500" /> Usage — last 7 days
              </h2>
              <span className="text-sm font-mono text-muted-foreground">{usageStats?.total ?? 0} requests</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 h-48">
                {usageStats && usageStats.series.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={usageStats.series} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { weekday: 'short' })}
                        tick={{ fontSize: 11, fontFamily: 'monospace' }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(251,101,30,0.08)' }}
                        contentStyle={{ fontFamily: 'monospace', fontSize: 12, background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                        labelFormatter={(d) => new Date(d as string).toLocaleDateString()}
                        formatter={(v) => [`${v} requests`, '']}
                      />
                      <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                        {usageStats.series.map((_, i) => <Cell key={i} fill="#FB651E" />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground font-mono">
                    No requests yet — make your first call to see usage here.
                  </div>
                )}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-2">Top endpoints</div>
                {usageStats && usageStats.by_endpoint.length > 0 ? (
                  <div className="space-y-1.5">
                    {usageStats.by_endpoint.slice(0, 6).map((e) => (
                      <div key={e.endpoint} className="flex items-center justify-between gap-2 text-xs font-mono">
                        <span className="truncate text-muted-foreground" title={e.endpoint}>{e.endpoint}</span>
                        <span className="text-foreground tabular-nums">{e.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground font-mono">—</div>
                )}
              </div>
            </div>
          </HackerCard>

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
