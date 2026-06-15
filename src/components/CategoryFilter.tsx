import { categories, type Category } from '@/data/tools'
import { cn } from '@/lib/utils'

interface CategoryFilterProps {
  active: Category
  onChange: (category: Category) => void
}

export default function CategoryFilter({ active, onChange }: CategoryFilterProps) {
  return (
    <div className="sticky top-[60px] z-40 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onChange(cat)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-150',
                active === cat
                  ? 'bg-[#1A73E8] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
