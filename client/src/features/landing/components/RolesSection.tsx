import { Shield, Check, Lock } from 'lucide-react'

export function RolesSection() {
  const roles = [
    { title: 'Admin', desc: 'Full system access & company management', permissions: ['POS', 'Invoice', 'Reports', 'Settings'] },
    { title: 'Master Manager', desc: 'Operational control over catalog, stock & POs', permissions: ['POS', 'Invoice', 'Reports'] },
    { title: 'POS User', desc: 'Cashier checkout & customer processing', permissions: ['POS'] },
    { title: 'TA User', desc: 'Takealot marketplace sync & order handling', permissions: ['POS', 'Reports'] },
  ]

  return (
    <section className="py-20 md:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-xs font-semibold text-zinc-900 font-mono mb-3">
            SECURITY & GOVERNANCE
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950">
            Granular user roles & permission matrix.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-zinc-600">
            Control access across store staff, cashiers, managers, and accountants with predefined security roles and module-level permission locks.
          </p>
        </div>

        {/* Roles Table Mockup */}
        <div className="max-w-4xl mx-auto bg-zinc-950 rounded-2xl border border-zinc-800 shadow-2xl p-6 sm:p-8 text-white">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-white" />
              <span className="font-bold text-sm text-zinc-200 uppercase tracking-wider font-mono">Role Access Matrix</span>
            </div>
            <span className="text-xs font-mono text-zinc-400">Audit Compliance Active</span>
          </div>

          <div className="mt-6 space-y-4">
            {roles.map((role) => (
              <div
                key={role.title}
                className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{role.title}</span>
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-300 border border-zinc-700">
                      System Role
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">{role.desc}</div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {['POS', 'Invoice', 'Reports', 'Settings'].map((m) => {
                    const hasAccess = role.permissions.includes(m)
                    return (
                      <span
                        key={m}
                        className={`px-2.5 py-1 rounded text-xs font-mono font-semibold flex items-center gap-1 ${
                          hasAccess
                            ? 'bg-white text-zinc-950 font-bold'
                            : 'bg-zinc-800/50 text-zinc-600 border border-zinc-800'
                        }`}
                      >
                        {hasAccess ? <Check className="w-3 h-3 text-zinc-950" /> : <Lock className="w-3 h-3 text-zinc-600" />}
                        {m}
                      </span>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
