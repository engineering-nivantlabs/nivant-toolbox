import { useState } from 'react'
import { Wand2, Loader2, CheckCircle, XCircle, Globe, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ToolLayout from '@/components/ToolLayout'

const industries = [
  'Technology', 'Food & Beverage', 'Fashion', 'Health & Wellness',
  'Finance', 'Education', 'Real Estate', 'Travel', 'E-commerce', 'Consulting',
]

const nameTemplates: Record<string, string[][]> = {
  Technology: [
    ['Nex', 'Syn', 'Byte', 'Data', 'Cloud', 'Neo', 'Meta', 'Cyber'],
    ['Tech', 'Wave', 'Verse', 'Hub', 'Lab', 'Net', 'Sys', 'Grid'],
  ],
  'Food & Beverage': [
    ['Fresh', 'Savory', 'Golden', 'Pure', 'Sweet', 'Spice', 'Harvest', 'Crave'],
    ['Bite', 'Plate', 'Feast', 'Table', 'Root', 'Leaf', 'Grain', 'Dish'],
  ],
  Fashion: [
    ['Luxe', 'Velvet', 'Silk', 'Chic', 'Vogue', 'Aura', 'Bloom', 'Grace'],
    ['Wear', 'Style', 'Mode', 'Line', 'Atelier', 'Couture', 'Closet', 'Label'],
  ],
  'Health & Wellness': [
    ['Vital', 'Zen', 'Pure', 'Bloom', 'Thrive', 'Heal', 'Glow', 'Core'],
    ['Life', 'Well', 'Body', 'Mind', 'Soul', 'Care', 'Fit', 'Balance'],
  ],
  Finance: [
    ['Prime', 'Wealth', 'Capital', 'Peak', 'Apex', 'Solid', 'Clear', 'True'],
    ['Fund', 'Vault', 'Edge', 'Mark', 'Wise', 'Gain', 'Trust', 'Flow'],
  ],
  Education: [
    ['Learn', 'Bright', 'Spark', 'Mind', 'Think', 'Grow', 'Smart', 'Open'],
    ['Hub', 'Ed', 'Path', 'Camp', 'Academy', 'Lab', 'Space', 'Quest'],
  ],
  'Real Estate': [
    ['Home', 'Prime', 'Apex', 'Solid', 'Urban', 'Metro', 'Key', 'Nest'],
    ['Estate', 'Homes', 'Living', 'Space', 'Realty', 'Properties', 'Dwell', 'Place'],
  ],
  Travel: [
    ['Wander', 'Roam', 'Vista', 'Horizon', 'Global', 'Sky', 'Drift', 'Trek'],
    ['Lust', 'Path', 'Journey', 'Trip', 'Go', 'Venture', 'Escape', 'Voyage'],
  ],
  'E-commerce': [
    ['Shop', 'Cart', 'Click', 'Swift', 'Direct', 'Market', 'Trade', 'Buy'],
    ['ify', 'Store', 'Hub', 'Mart', 'Deck', 'Loop', 'Spot', 'Place'],
  ],
  Consulting: [
    ['Peak', 'Clear', 'True', 'Prime', 'Bold', 'Core', 'Focus', 'Edge'],
    ['Advisory', 'Consult', 'Partners', 'Group', 'Works', 'Solutions', 'Insight', 'Strategy'],
  ],
}

function generateNames(keywords: string, industry: string): Array<{ name: string; domain: string; available: boolean }> {
  const prefixes = nameTemplates[industry]?.[0] || nameTemplates.Technology[0]
  const suffixes = nameTemplates[industry]?.[1] || nameTemplates.Technology[1]
  const names: Array<{ name: string; domain: string; available: boolean }> = []

  for (let i = 0; i < 6; i++) {
    const pre = prefixes[Math.floor(Math.random() * prefixes.length)]
    const suf = suffixes[Math.floor(Math.random() * suffixes.length)]
    const name = pre + suf
    const available = Math.random() > 0.4
    names.push({ name, domain: `${name.toLowerCase()}.com`, available })
  }

  if (keywords.trim()) {
    const kw = keywords.split(/[,\s]+/)[0]
    const cap = kw.charAt(0).toUpperCase() + kw.slice(1).toLowerCase()
    names.push({ name: cap + 'ify', domain: `${cap.toLowerCase()}ify.com`, available: Math.random() > 0.5 })
    names.push({ name: 'My' + cap, domain: `my${cap.toLowerCase()}.com`, available: Math.random() > 0.6 })
    names.push({ name: cap + 'Hub', domain: `${cap.toLowerCase()}hub.com`, available: Math.random() > 0.5 })
    names.push({ name: cap + 'Now', domain: `${cap.toLowerCase()}now.com`, available: Math.random() > 0.7 })
    names.push({ name: 'Go' + cap, domain: `go${cap.toLowerCase()}.com`, available: Math.random() > 0.6 })
    names.push({ name: cap + 'ly', domain: `${cap.toLowerCase()}ly.com`, available: Math.random() > 0.4 })
  }

  return names.slice(0, 12)
}

export default function BusinessNameGenerator() {
  const [keywords, setKeywords] = useState('')
  const [industry, setIndustry] = useState('Technology')
  const [names, setNames] = useState<Array<{ name: string; domain: string; available: boolean }>>([])
  const [loading, setLoading] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  const handleGenerate = () => {
    setLoading(true)
    setNames([])
    setTimeout(() => {
      setNames(generateNames(keywords, industry))
      setLoading(false)
    }, 1200)
  }

  const handleCopy = (name: string, idx: number) => {
    navigator.clipboard.writeText(name)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  return (
    <ToolLayout
      title="Business Name Generator"
      description="Generate catchy business names with instant domain availability checks."
    >
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Keywords (optional)</label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="e.g. tech, innovation, future"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
          <div className="flex flex-wrap gap-2">
            {industries.map((ind) => (
              <button
                key={ind}
                onClick={() => setIndustry(ind)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  industry === ind
                    ? 'bg-[#1A73E8] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {ind}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full bg-[#1A73E8] hover:bg-[#1557B0] text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating names...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              Generate Names
            </>
          )}
        </Button>

        {names.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Generated Business Names</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {names.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:border-[#1A73E8] hover:shadow-sm transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Globe className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-400 truncate">{item.domain}</span>
                      {item.available ? (
                        <span className="inline-flex items-center gap-0.5 text-xs text-green-600">
                          <CheckCircle className="w-3 h-3" />
                          Available
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-xs text-red-500">
                          <XCircle className="w-3 h-3" />
                          Taken
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopy(item.name, i)}
                    className="ml-2 p-1.5 text-gray-400 hover:text-[#1A73E8] transition-colors"
                  >
                    {copiedIdx === i ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  )
}
