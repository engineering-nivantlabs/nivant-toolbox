import { useState } from "react"

const mockStats = {
  totalUsers: 1247,
  activeToday: 89,
  revenue: 4280,
  apiCalls: 34500,
  signupsThisWeek: [12, 18, 9, 22, 15, 31, 27],
}

function StatCard({ label, value, change }: { label: string; value: string; change: string }) {
  const positive = change.startsWith("+")
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className={`text-xs mt-1 ${positive ? "text-green-400" : "text-red-400"}`}>{change} vs last week</p>
    </div>
  )
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<"overview" | "users" | "revenue">("overview")

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-400 text-sm">Monitor your product metrics</p>
        </div>
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {(["overview", "users", "revenue"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm capitalize transition-colors ${tab === t ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}>
              {t}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Users" value={mockStats.totalUsers.toLocaleString()} change="+12%" />
        <StatCard label="Active Today" value={mockStats.activeToday.toString()} change="+5%" />
        <StatCard label="Revenue (MTD)" value={`$${mockStats.revenue.toLocaleString()}`} change="+18%" />
        <StatCard label="API Calls" value={`${(mockStats.apiCalls / 1000).toFixed(1)}K`} change="+8%" />
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h2 className="font-semibold mb-4">Signups This Week</h2>
        <div className="flex items-end gap-2 h-32">
          {mockStats.signupsThisWeek.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-blue-600 rounded-t" style={{ height: `${(v / 35) * 100}%` }} />
              <span className="text-xs text-gray-500">{["M", "T", "W", "T", "F", "S", "S"][i]}</span>
            </div>
          ))}
        </div>
      </div>

      {tab === "users" && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h2 className="font-semibold mb-4">Recent Users</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-400 border-b border-gray-700">
              <th className="pb-2">Email</th><th className="pb-2">Plan</th><th className="pb-2">Credits</th><th className="pb-2">Joined</th>
            </tr></thead>
            <tbody>
              {[
                { email: "alice@example.com", plan: "Pro", credits: 420, joined: "2 days ago" },
                { email: "bob@example.com", plan: "Starter", credits: 65, joined: "5 days ago" },
                { email: "carol@example.com", plan: "Free", credits: 3, joined: "1 week ago" },
              ].map(u => (
                <tr key={u.email} className="border-b border-gray-800">
                  <td className="py-3">{u.email}</td>
                  <td><span className="px-2 py-0.5 rounded-full bg-blue-900 text-blue-300 text-xs">{u.plan}</span></td>
                  <td>{u.credits}</td><td className="text-gray-400">{u.joined}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "revenue" && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h2 className="font-semibold mb-4">Revenue Breakdown</h2>
          <div className="space-y-3">
            {[
              { plan: "Unlimited ($79)", pct: 45, amount: "$1,926" },
              { plan: "Pro ($29)", pct: 35, amount: "$1,498" },
              { plan: "Starter ($9)", pct: 20, amount: "$856" },
            ].map(r => (
              <div key={r.plan}>
                <div className="flex justify-between text-sm mb-1"><span>{r.plan}</span><span>{r.amount}</span></div>
                <div className="h-2 bg-gray-700 rounded-full"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${r.pct}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
