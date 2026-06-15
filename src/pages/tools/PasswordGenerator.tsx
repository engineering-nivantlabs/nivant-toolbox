import { useState, useCallback } from 'react'
import { RefreshCw, Copy, Check, Shield, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import ToolLayout from '@/components/ToolLayout'

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'
const NUMBERS = '0123456789'
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?'

function generatePassword(length: number, useUpper: boolean, useLower: boolean, useNumbers: boolean, useSymbols: boolean): string {
  let chars = ''
  if (useUpper) chars += UPPERCASE
  if (useLower) chars += LOWERCASE
  if (useNumbers) chars += NUMBERS
  if (useSymbols) chars += SYMBOLS

  if (chars === '') return ''

  const array = new Uint32Array(length)
  crypto.getRandomValues(array)

  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars[array[i] % chars.length]
  }

  return password
}

function calculateStrength(password: string): { score: number; label: string; color: string } {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (password.length >= 16) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' }
  if (score <= 4) return { score, label: 'Fair', color: 'bg-yellow-500' }
  if (score <= 5) return { score, label: 'Good', color: 'bg-blue-500' }
  return { score, label: 'Strong', color: 'bg-green-500' }
}

export default function PasswordGenerator() {
  const [length, setLength] = useState([16])
  const [useUppercase, setUseUppercase] = useState(true)
  const [useLowercase, setUseLowercase] = useState(true)
  const [useNumbers, setUseNumbers] = useState(true)
  const [useSymbols, setUseSymbols] = useState(true)
  const [password, setPassword] = useState('')
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<string[]>([])

  const handleGenerate = useCallback(() => {
    const newPassword = generatePassword(length[0], useUppercase, useLowercase, useNumbers, useSymbols)
    setPassword(newPassword)
    if (newPassword) {
      setHistory((prev) => [newPassword, ...prev].slice(0, 10))
    }
  }, [length, useUppercase, useLowercase, useNumbers, useSymbols])

  useState(() => {
    handleGenerate()
  })

  const handleCopy = () => {
    if (!password) return
    navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const strength = calculateStrength(password)

  return (
    <ToolLayout
      title="Password Generator"
      description="Generate secure, random passwords with customizable length and character types."
    >
      <div className="space-y-6">
        {/* Password Display */}
        <div className="bg-gray-900 rounded-xl p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xl md:text-2xl font-mono text-white break-all tracking-wider">
                {password || 'Generate a password'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                disabled={!password}
                className="p-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors disabled:opacity-30"
                title="Copy password"
              >
                {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
              </button>
              <button
                onClick={handleGenerate}
                className="p-2.5 bg-[#1A73E8] hover:bg-[#1557B0] rounded-lg text-white transition-colors"
                title="Generate new"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Strength meter */}
          {password && (
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${strength.color} rounded-full transition-all duration-300`}
                  style={{ width: `${(strength.score / 7) * 100}%` }}
                />
              </div>
              <span className={`text-xs font-medium ${strength.color.replace('bg-', 'text-')}`}>
                {strength.label}
              </span>
              {strength.label === 'Strong' && <ShieldCheck className="w-4 h-4 text-green-500" />}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Length: <span className="text-[#1A73E8] font-semibold text-lg">{length[0]}</span>
            </label>
            <Slider
              value={length}
              onValueChange={setLength}
              min={4}
              max={64}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>4</span>
              <span>64</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:border-gray-300 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Uppercase</span>
                <span className="text-xs text-gray-400 font-mono">A-Z</span>
              </div>
              <Switch checked={useUppercase} onCheckedChange={setUseUppercase} />
            </label>
            <label className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:border-gray-300 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Lowercase</span>
                <span className="text-xs text-gray-400 font-mono">a-z</span>
              </div>
              <Switch checked={useLowercase} onCheckedChange={setUseLowercase} />
            </label>
            <label className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:border-gray-300 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Numbers</span>
                <span className="text-xs text-gray-400 font-mono">0-9</span>
              </div>
              <Switch checked={useNumbers} onCheckedChange={setUseNumbers} />
            </label>
            <label className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:border-gray-300 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Symbols</span>
                <span className="text-xs text-gray-400 font-mono">!@#$</span>
              </div>
              <Switch checked={useSymbols} onCheckedChange={setUseSymbols} />
            </label>
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          className="w-full bg-[#1A73E8] hover:bg-[#1557B0] text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 text-base"
        >
          <Shield className="w-5 h-5" />
          Generate Password
        </Button>

        {/* History */}
        {history.length > 1 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Recent Passwords</h3>
            <div className="space-y-1.5">
              {history.slice(1, 6).map((pwd, i) => (
                <button
                  key={i}
                  onClick={() => setPassword(pwd)}
                  className="w-full text-left px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-mono text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-all truncate"
                >
                  {pwd}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  )
}
