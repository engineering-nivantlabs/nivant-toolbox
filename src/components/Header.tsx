import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Sparkles, Menu, X, Crown } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Header() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery.trim())}`)
      setSearchOpen(false)
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 h-[60px] flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-[22px] font-bold text-gray-900 tracking-tight">
              BoredHumans
              <span className="text-[#1A73E8]">.</span>
            </span>
          </Link>
        </div>

        <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
          <form onSubmit={handleSearch} className="w-full relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search 100+ AI tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:border-transparent transition-all"
            />
          </form>
        </div>

        <div className="flex items-center gap-3">
          <button
            className="md:hidden p-2 text-gray-500 hover:text-gray-700"
            onClick={() => setSearchOpen(!searchOpen)}
          >
            <Search className="w-5 h-5" />
          </button>
          <Button
            onClick={() => navigate('/premium')}
            className="bg-[#1A73E8] hover:bg-[#1557B0] text-white text-sm font-medium rounded-full px-4 py-2 hidden sm:flex items-center gap-2"
          >
            <Crown className="w-4 h-4" />
            Premium
          </Button>
          <button
            className="sm:hidden p-2 text-gray-500 hover:text-gray-700"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="md:hidden px-4 pb-3">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
              autoFocus
            />
          </form>
        </div>
      )}

      {mobileMenuOpen && (
        <div className="sm:hidden px-4 pb-3 border-t border-gray-100">
          <button
            onClick={() => { navigate('/premium'); setMobileMenuOpen(false) }}
            className="flex items-center gap-2 py-3 text-sm font-medium text-[#1A73E8]"
          >
            <Crown className="w-4 h-4" />
            Go Premium
          </button>
        </div>
      )}
    </header>
  )
}
