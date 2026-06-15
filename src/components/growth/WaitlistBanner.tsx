import { useState } from "react"

export default function WaitlistBanner() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    // In production: POST to /api/waitlist or Supabase
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="bg-green-900/30 border border-green-700 rounded-xl p-6 text-center">
        <p className="text-green-400 font-medium">You're on the list! We'll notify you when we launch.</p>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-800/50 rounded-xl p-6">
      <h3 className="text-lg font-bold mb-1">Get Early Access</h3>
      <p className="text-sm text-gray-400 mb-4">Join the waitlist for exclusive launch pricing and bonus credits.</p>
      <form onSubmit={submit} className="flex gap-2">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="submit" className="bg-blue-600 hover:bg-blue-700 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors">
          Join Waitlist
        </button>
      </form>
    </div>
  )
}
