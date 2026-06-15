import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Sparkles, Zap } from 'lucide-react'
import { tools, categories, type Category } from '@/data/tools'
import CategoryFilter from '@/components/CategoryFilter'
import ToolCard from '@/components/ToolCard'
import { Button } from '@/components/ui/button'

export default function Home() {
  const [searchParams] = useSearchParams()
  const searchQuery = searchParams.get('search') || ''

  const [activeCategory, setActiveCategory] = useState<Category>('All')
  const [visibleCount, setVisibleCount] = useState(24)

  const filteredTools = useMemo(() => {
    let filtered = tools

    if (activeCategory !== 'All') {
      filtered = filtered.filter((t) => t.category === activeCategory)
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      )
    }

    return filtered
  }, [activeCategory, searchQuery])

  const visibleTools = filteredTools.slice(0, visibleCount)
  const hasMore = visibleTools.length < filteredTools.length

  const featuredTools = tools.filter((t) => t.featured)

  return (
    <div>
      {/* Hero */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#E8F0FE] text-[#1A73E8] rounded-full text-xs font-medium mb-4">
            <Sparkles className="w-3 h-3" />
            100+ AI-Powered Tools
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
            Every AI Tool You Need,
            <br />
            <span className="text-[#1A73E8]">All in One Place</span>
          </h1>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm md:text-base">
            Browse our massive collection of free AI tools for writing, images, code, business, and more.
          </p>

          {/* Featured row */}
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {featuredTools.map((tool) => (
              <a
                key={tool.id}
                href={`#${tool.route}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-xs font-medium text-gray-700 hover:border-[#1A73E8] hover:text-[#1A73E8] transition-all"
              >
                <Zap className="w-3 h-3" />
                {tool.name}
              </a>
            ))}
          </div>
        </div>
      </div>

      <CategoryFilter active={activeCategory} onChange={setActiveCategory} />

      {/* Stats bar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {filteredTools.length} tool{filteredTools.length !== 1 ? 's' : ''} available
          {searchQuery && (
            <span>
              {' '}
              for &quot;<span className="text-gray-600">{searchQuery}</span>&quot;
            </span>
          )}
        </p>
      </div>

      {/* Tool Grid */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {visibleTools.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visibleTools.map((tool, i) => (
                <ToolCard key={tool.id} tool={tool} index={i} />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-8">
                <Button
                  variant="outline"
                  onClick={() => setVisibleCount((c) => c + 24)}
                  className="px-6 py-2 border-gray-200 text-gray-600 hover:bg-gray-50 rounded-full text-sm"
                >
                  Load More Tools
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">No tools found matching your criteria.</p>
            <Button
              variant="link"
              onClick={() => { setActiveCategory('All'); }}
              className="text-[#1A73E8] mt-2 text-sm"
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {/* Ad Placeholder */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 text-center">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Advertisement</p>
        </div>
      </div>
    </div>
  )
}
