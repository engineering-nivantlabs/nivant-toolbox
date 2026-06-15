import { useState } from 'react'
import { Copy, Download, Wand2, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import ToolLayout from '@/components/ToolLayout'

const tones = ['Academic', 'Casual', 'Persuasive', 'Informative', 'Narrative']

const mockEssays: Record<string, Record<string, string>> = {
  Academic: {
    technology: `The Impact of Artificial Intelligence on Modern Society

Introduction
Artificial intelligence has emerged as one of the most transformative technologies of the 21st century. From healthcare to finance, AI systems are reshaping how we live, work, and interact with the world around us. This essay explores the multifaceted impact of AI on modern society, examining both its tremendous benefits and the significant challenges it presents.

The Evolution of Artificial Intelligence
The concept of artificial intelligence dates back to the mid-20th century when pioneers like Alan Turing and John McCarthy first explored the possibility of machine intelligence. Early AI systems were limited by computational constraints, but decades of research and exponential growth in computing power have enabled breakthroughs that once seemed impossible. Machine learning, deep learning, and neural networks now power applications that touch every aspect of daily life.

Benefits and Opportunities
AI technology offers unprecedented opportunities for progress. In healthcare, machine learning algorithms can detect diseases earlier and more accurately than human physicians. Autonomous vehicles promise to reduce traffic accidents and improve transportation efficiency. In education, personalized learning systems adapt to individual student needs, potentially revolutionizing how knowledge is delivered.

Challenges and Ethical Considerations
Despite its promise, AI presents significant challenges. Job displacement remains a primary concern as automation threatens traditional employment across multiple sectors. Privacy concerns arise from the vast amounts of data required to train AI systems. Algorithmic bias can perpetuate and amplify existing societal inequalities if left unchecked.

Conclusion
Artificial intelligence represents a double-edged sword for modern society. While the technology holds immense potential to solve complex problems and improve quality of life, careful governance and ethical frameworks are essential to ensure its benefits are distributed equitably.`,
    default: `The Role of Innovation in Shaping the Future

Introduction
Innovation has always been the driving force behind human progress. From the invention of the wheel to the development of the internet, each breakthrough has fundamentally altered the trajectory of civilization. Today, we stand at the precipice of another transformative era, where rapid technological advancement promises to reshape every aspect of our existence.

The Nature of Innovation
Innovation is not merely about creating new technologies; it encompasses new ways of thinking, organizing, and problem-solving. It requires a delicate balance of creativity and discipline, imagination and pragmatism. The most impactful innovations often emerge at the intersection of different fields, where diverse perspectives converge to generate novel solutions.

Impact on Economic Growth
Innovation is the primary engine of economic growth in the modern world. Countries that invest heavily in research and development consistently outperform those that do not. New industries emerge around breakthrough technologies, creating jobs and wealth while rendering older industries obsolete.

Social and Cultural Implications
Beyond economics, innovation profoundly influences social structures and cultural norms. Communication technologies have connected people across the globe, fostering unprecedented levels of cultural exchange. Medical innovations have doubled average life expectancy over the past century.

Conclusion
As we look toward the future, the pace of innovation shows no signs of slowing. Embracing this change while managing its disruptive effects will be one of the defining challenges of our time.`,
  },
  Casual: {
    default: `Why Weekends Are the Best Part of Life

Let me be honest — if I could structure my entire life around weekends, I absolutely would. There is something magical about those two days that somehow feel completely different from the rest of the week.

First of all, there is the sleeping in part. During the week, my alarm and I have a very toxic relationship. It goes off, I hit snooze approximately seventeen times, and eventually I drag myself out of bed. But on weekends? The alarm gets a well-deserved break. I wake up naturally, usually way later than I intended, and somehow that feels completely fine.

Then there is the food situation. Weekday meals are all about speed and convenience. Weekend meals are an event. Brunch becomes this glorious ritual where you can spend two hours over pancakes and coffee.

The best part, though, is the freedom. No meetings, no deadlines, no obligations. You can do absolutely anything or absolutely nothing, and both are equally valid choices.`,
  },
  Persuasive: {
    default: `Why Remote Work Should Be the Standard

The traditional office model is outdated, inefficient, and counterproductive. It is time for companies to embrace remote work as the default, not the exception. The evidence is overwhelming, and the benefits extend to employees, employers, and society as a whole.

First, consider productivity. Study after study has shown that remote workers are more productive than their office-bound counterparts. Without the distractions of open-plan offices, constant interruptions, and lengthy commutes, employees can focus deeply on their work.

The environmental argument is equally compelling. Eliminating daily commutes would dramatically reduce carbon emissions. If even half of the workforce worked remotely, the environmental impact would be equivalent to taking millions of cars off the road permanently.

Work-life balance improves dramatically with remote work. Parents can be present for their children. People can live in affordable areas instead of expensive cities. Employees save thousands on commuting costs, work clothes, and eating out.

Some argue that remote work harms collaboration and company culture. This is simply not supported by the evidence. With the right tools and intentional practices, remote teams can be just as connected and collaborative.`,
  },
  Informative: {
    default: `Understanding Climate Change: A Comprehensive Overview

Climate change refers to long-term shifts in global temperatures and weather patterns. While climate variations can occur naturally, the current warming trend is of particular concern because it is predominantly driven by human activities.

The primary cause of contemporary climate change is the greenhouse effect. Certain gases in Earth's atmosphere trap heat from the sun, preventing it from escaping back into space. Carbon dioxide, methane, and nitrous oxide are the main greenhouse gases emitted through human activities.

Since the Industrial Revolution, human activities have significantly increased greenhouse gas concentrations. Burning fossil fuels for electricity, heat, and transportation is the largest source of emissions. Deforestation, agriculture, and industrial processes also contribute substantially.

The effects of climate change are already observable worldwide. Global temperatures have risen by approximately 1.1 degrees Celsius since pre-industrial times. Sea levels are rising due to thermal expansion and melting ice sheets. Extreme weather events are becoming more frequent and intense.

Scientists project that without significant intervention, global temperatures could rise by 2 to 4 degrees Celsius by 2100. This would have catastrophic consequences including widespread species extinction, agricultural collapse, and displacement of hundreds of millions of people.`,
  },
  Narrative: {
    default: `The Day Everything Changed

It started as an ordinary Tuesday morning. The sun rose over the quiet suburban neighborhood, casting long shadows across manicured lawns. Sarah stood at her kitchen window, coffee in hand, watching her neighbors begin their daily routines.

She had no way of knowing that within hours, everything she took for granted would be turned upside down.

The first sign came at 9:47 AM. Sarah was halfway through a routine email when her phone buzzed with an emergency alert. She glanced at the screen, expecting a weather warning or traffic update. Instead, four words stopped her cold: "Remain indoors. Do not."

Before she could process what she was reading, a low rumble began to build. It started as a distant vibration, barely perceptible, but grew rapidly into a deep, resonant sound that seemed to emanate from everywhere and nowhere at once.

Sarah rushed to the window. What she saw defied explanation.`,
  },
}

function getEssay(topic: string, tone: string) {
  const t = mockEssays[tone] || mockEssays.Academic
  const key = Object.keys(t).find((k) => topic.toLowerCase().includes(k)) || 'default'
  return t[key] || t.default
}

export default function EssayWriter() {
  const [topic, setTopic] = useState('')
  const [wordCount, setWordCount] = useState([500])
  const [tone, setTone] = useState('Academic')
  const [essay, setEssay] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleGenerate = () => {
    if (!topic.trim()) return
    setLoading(true)
    setEssay('')
    setTimeout(() => {
      setEssay(getEssay(topic, tone))
      setLoading(false)
    }, 1500)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(essay)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([essay], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'essay.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <ToolLayout
      title="Essay Writer"
      description="Generate well-structured essays on any topic with customizable tone and length."
    >
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Topic</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter your essay topic..."
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target Word Count: <span className="text-[#1A73E8] font-semibold">{wordCount[0]}</span>
          </label>
          <Slider
            value={wordCount}
            onValueChange={setWordCount}
            min={100}
            max={2000}
            step={100}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>100</span>
            <span>2000</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
          <div className="flex flex-wrap gap-2">
            {tones.map((t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  tone === t
                    ? 'bg-[#1A73E8] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={!topic.trim() || loading}
          className="w-full bg-[#1A73E8] hover:bg-[#1557B0] text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Writing your essay...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              Generate Essay
            </>
          )}
        </Button>

        {essay && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">Generated Essay</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="text-xs flex items-center gap-1"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="text-xs flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  Download
                </Button>
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 text-sm leading-relaxed whitespace-pre-wrap text-gray-800 max-h-[600px] overflow-y-auto">
              {essay}
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  )
}
