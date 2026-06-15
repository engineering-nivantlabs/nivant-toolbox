import { useState } from 'react'
import { Wand2, Loader2, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ToolLayout from '@/components/ToolLayout'

const summaryLengths = [
  { label: 'Short', value: 'short', description: '1-2 bullet points' },
  { label: 'Medium', value: 'medium', description: '3-5 bullet points' },
  { label: 'Long', value: 'long', description: '6-8 bullet points' },
]

function generateMockSummary(text: string, length: string): string[] {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10)
  const count = length === 'short' ? 2 : length === 'medium' ? 4 : 6

  if (sentences.length === 0) {
    return [
      'The text discusses key concepts and ideas that are central to the topic.',
      'Important themes and patterns emerge throughout the discussion.',
      'The content provides insights that contribute to a broader understanding.',
      'Further analysis could reveal additional connections and implications.',
    ].slice(0, count)
  }

  const bullets = sentences.slice(0, count).map((s) => {
    const trimmed = s.trim()
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1) + '.'
  })

  while (bullets.length < count) {
    bullets.push('Additional analysis reveals supporting evidence and context.')
  }

  return bullets
}

export default function TextSummarizer() {
  const [text, setText] = useState('')
  const [length, setLength] = useState('medium')
  const [summary, setSummary] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleSummarize = () => {
    if (!text.trim()) return
    setLoading(true)
    setSummary([])
    setTimeout(() => {
      setSummary(generateMockSummary(text, length))
      setLoading(false)
    }, 1200)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(summary.map((s) => `\u2022 ${s}`).join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const sampleText = `Artificial intelligence (AI) is transforming the way we live and work. Machine learning algorithms can now process vast amounts of data to identify patterns that humans might miss. In healthcare, AI systems are being used to detect diseases earlier and with greater accuracy than traditional methods. The financial industry uses AI for fraud detection, algorithmic trading, and risk assessment. However, the rapid advancement of AI also raises important ethical questions about privacy, job displacement, and algorithmic bias. Governments and organizations around the world are working to develop frameworks for responsible AI development. Education systems are adapting to prepare students for an AI-driven future. Researchers continue to push the boundaries of what AI can achieve, from natural language understanding to creative tasks. The integration of AI into everyday devices is making smart technology more accessible to everyone. As AI capabilities grow, so does the need for thoughtful governance and ethical considerations.`

  return (
    <ToolLayout
      title="Text Summarizer"
      description="Condense long articles and documents into concise bullet-point summaries."
    >
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Input Text</label>
            <button
              onClick={() => setText(sampleText)}
              className="text-xs text-[#1A73E8] hover:underline"
            >
              Load sample text
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your text here to summarize..."
            rows={8}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:border-transparent resize-none"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{text.length} characters</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Summary Length</label>
          <div className="grid grid-cols-3 gap-3">
            {summaryLengths.map((sl) => (
              <button
                key={sl.value}
                onClick={() => setLength(sl.value)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  length === sl.value
                    ? 'border-[#1A73E8] bg-[#E8F0FE]'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className={`text-sm font-medium ${length === sl.value ? 'text-[#1A73E8]' : 'text-gray-700'}`}>
                  {sl.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{sl.description}</p>
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleSummarize}
          disabled={!text.trim() || loading}
          className="w-full bg-[#1A73E8] hover:bg-[#1557B0] text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Summarizing...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              Summarize
            </>
          )}
        </Button>

        {summary.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">Summary</h3>
              <Button variant="outline" size="sm" onClick={handleCopy} className="text-xs flex items-center gap-1">
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
              <ul className="space-y-2.5">
                {summary.map((bullet, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-[#1A73E8] mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#1A73E8]" />
                    <span className="leading-relaxed">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  )
}
