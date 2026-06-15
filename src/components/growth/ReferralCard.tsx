import { useState } from "react"

export default function ReferralCard({ code = "NIVANT25" }: { code?: string }) {
  const [copied, setCopied] = useState(false)
  const link = `https://nivant.com/ref/${code}`

  const copy = () => {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
      <h3 className="font-bold mb-1">Refer & Earn</h3>
      <p className="text-sm text-gray-400 mb-4">Give friends 25% off, get 50 bonus credits per referral.</p>
      <div className="flex gap-2">
        <input readOnly value={link} className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300" />
        <button onClick={copy} className="bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2 text-sm transition-colors">
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  )
}
