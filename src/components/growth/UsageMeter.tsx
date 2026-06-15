interface Props { used: number; total: number; label?: string }

export default function UsageMeter({ used, total, label = "Credits" }: Props) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-500" : "bg-blue-500"

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-gray-400">{label}</span>
        <span className="font-medium">{used} / {total}</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      {pct > 80 && <p className="text-xs text-yellow-400 mt-2">Running low — upgrade for more credits</p>}
    </div>
  )
}
