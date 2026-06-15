import { useState } from 'react'
import { Wand2, Loader2, Code2, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ToolLayout from '@/components/ToolLayout'

const languages = ['JavaScript', 'Python', 'Java', 'TypeScript', 'C++', 'Go', 'Rust', 'SQL', 'HTML/CSS', 'Ruby']

const sampleCode = `function fibonacci(n) {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    let temp = a + b;
    a = b;
    b = temp;
  }
  return b;
}`

const explanations: Record<string, string[]> = {
  JavaScript: [
    'The function `fibonacci(n)` takes a single parameter `n`, which represents the position in the Fibonacci sequence.',
    'The base case checks if `n` is 0 or 1. If so, it returns `n` directly since F(0) = 0 and F(1) = 1.',
    'Two variables `a` and `b` are initialized to 0 and 1, representing the first two Fibonacci numbers.',
    'A `for` loop runs from 2 up to `n`, iteratively computing each Fibonacci number.',
    'Inside the loop, `temp` stores the sum of `a` and `b`, then the variables are shifted: `a` takes `b`\'s value, and `b` takes the new sum.',
    'This iterative approach runs in O(n) time with O(1) space, making it much more efficient than the recursive O(2\u207f) solution.',
    'Finally, the function returns `b`, which holds the nth Fibonacci number.',
  ],
  Python: [
    'The function `fibonacci(n)` accepts an integer parameter `n` representing the desired position in the Fibonacci sequence.',
    'The if statement handles the base cases: when n is 0 or 1, the function returns n immediately.',
    'Variables `a` and `b` are initialized to 0 and 1, storing consecutive Fibonacci numbers.',
    'The for loop iterates from 2 through n, calculating each subsequent number in the sequence.',
    'Tuple unpacking `a, b = b, a + b` simultaneously updates both variables without a temporary variable.',
    'This approach achieves O(n) time complexity and O(1) space complexity.',
    'The function returns `b`, which contains the nth Fibonacci number after the loop completes.',
  ],
  default: [
    'The function accepts a parameter `n` which specifies the target position in the sequence.',
    'A base case check handles the first two positions (0 and 1) by returning `n` directly.',
    'Two accumulator variables are initialized to track the previous two values in the sequence.',
    'A loop iterates from position 2 up to `n`, computing each value based on the previous two.',
    'Inside the loop, a temporary variable holds the sum before updating the accumulators.',
    'This iterative algorithm runs in linear time with constant space usage.',
    'The function returns the final computed value at position `n`.',
  ],
}

export default function CodeExplainer() {
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('JavaScript')
  const [explanation, setExplanation] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleExplain = () => {
    if (!code.trim()) return
    setLoading(true)
    setExplanation([])
    setTimeout(() => {
      setExplanation(explanations[language] || explanations.default)
      setLoading(false)
    }, 1500)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(explanation.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <ToolLayout
      title="Code Explainer"
      description="Paste any code snippet and get a step-by-step plain English explanation."
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <Code2 className="w-4 h-4" />
              Code
            </label>
            <button
              onClick={() => setCode(sampleCode)}
              className="text-xs text-[#1A73E8] hover:underline"
            >
              Load sample
            </button>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste your code here..."
            rows={10}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm font-mono bg-gray-900 text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:border-transparent resize-none"
            spellCheck={false}
          />
        </div>

        <Button
          onClick={handleExplain}
          disabled={!code.trim() || loading}
          className="w-full bg-[#1A73E8] hover:bg-[#1557B0] text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing code...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              Explain Code
            </>
          )}
        </Button>

        {explanation.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">Step-by-Step Explanation</h3>
              <Button variant="outline" size="sm" onClick={handleCopy} className="text-xs flex items-center gap-1">
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 space-y-3">
              {explanation.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#1A73E8] text-white text-xs font-medium flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-gray-700 leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  )
}
