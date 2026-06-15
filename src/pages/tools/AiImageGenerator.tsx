import { useState } from 'react'
import { Wand2, Loader2, ImageIcon, Download, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ToolLayout from '@/components/ToolLayout'

const styles = ['Realistic', 'Anime', 'Oil Painting', 'Digital Art', '3D Render', 'Sketch', 'Watercolor', 'Cyberpunk']
const sizes = [
  { label: 'Square (1:1)', w: 512, h: 512 },
  { label: 'Portrait (2:3)', w: 512, h: 768 },
  { label: 'Landscape (3:2)', w: 768, h: 512 },
  { label: 'Wide (16:9)', w: 768, h: 432 },
]

const gradientPresets = [
  'from-purple-500 via-pink-500 to-red-500',
  'from-blue-500 via-cyan-500 to-teal-500',
  'from-emerald-500 via-green-500 to-lime-500',
  'from-amber-500 via-orange-500 to-yellow-500',
  'from-indigo-500 via-violet-500 to-fuchsia-500',
  'from-rose-500 via-red-500 to-orange-500',
  'from-cyan-500 via-sky-500 to-blue-500',
  'from-teal-500 via-emerald-500 to-green-500',
]

interface GeneratedImage {
  id: string
  prompt: string
  style: string
  gradient: string
  sizeLabel: string
  timestamp: Date
}

export default function AiImageGenerator() {
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('Digital Art')
  const [size, setSize] = useState(sizes[0])
  const [loading, setLoading] = useState(false)
  const [gallery, setGallery] = useState<GeneratedImage[]>([])
  const [currentImage, setCurrentImage] = useState<GeneratedImage | null>(null)

  const handleGenerate = () => {
    if (!prompt.trim()) return
    setLoading(true)
    setCurrentImage(null)
    setTimeout(() => {
      const newImage: GeneratedImage = {
        id: Date.now().toString(),
        prompt: prompt.trim(),
        style,
        gradient: gradientPresets[Math.floor(Math.random() * gradientPresets.length)],
        sizeLabel: size.label,
        timestamp: new Date(),
      }
      setCurrentImage(newImage)
      setGallery((prev) => [newImage, ...prev])
      setLoading(false)
    }, 2000)
  }

  return (
    <ToolLayout
      title="AI Image Generator"
      description="Generate stunning AI images from text prompts. Choose your style and size."
    >
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A serene mountain landscape at sunset with a crystal clear lake..."
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:border-transparent resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Style</label>
          <div className="flex flex-wrap gap-2">
            {styles.map((s) => (
              <button
                key={s}
                onClick={() => setStyle(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  style === s
                    ? 'bg-[#1A73E8] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Size</label>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button
                key={s.label}
                onClick={() => setSize(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  size.label === s.label
                    ? 'bg-[#1A73E8] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={!prompt.trim() || loading}
          className="w-full bg-[#1A73E8] hover:bg-[#1557B0] text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating image...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              Generate Image
            </>
          )}
        </Button>

        {/* Result */}
        {currentImage && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-medium text-gray-700">Generated Image</h3>
                <p className="text-xs text-gray-400 mt-0.5">{currentImage.style} &middot; {currentImage.sizeLabel}</p>
              </div>
              <Button variant="outline" size="sm" className="text-xs flex items-center gap-1">
                <Download className="w-3 h-3" />
                Download
              </Button>
            </div>
            <div className="relative rounded-xl overflow-hidden shadow-lg border border-gray-200">
              <div
                className={`bg-gradient-to-br ${currentImage.gradient} flex items-center justify-center`}
                style={{ width: '100%', aspectRatio: `${size.w}/${size.h}` }}
              >
                <div className="text-center px-8">
                  <ImageIcon className="w-12 h-12 text-white/60 mx-auto mb-3" />
                  <p className="text-white/90 text-sm font-medium">{currentImage.prompt}</p>
                  <p className="text-white/50 text-xs mt-2">{currentImage.style}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gallery */}
        {gallery.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Previous Generations
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {gallery.slice(1).map((img) => (
                <div
                  key={img.id}
                  className="rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setCurrentImage(img)}
                >
                  <div className={`bg-gradient-to-br ${img.gradient} aspect-square flex items-center justify-center p-4`}>
                    <p className="text-white/80 text-xs text-center line-clamp-3">{img.prompt}</p>
                  </div>
                  <div className="px-2 py-1.5 bg-white">
                    <p className="text-[10px] text-gray-400 truncate">{img.style}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  )
}
