import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { Tool } from '@/data/tools'
import type { LucideIcon } from 'lucide-react'

interface ToolCardProps {
  tool: Tool
  index: number
}

export default function ToolCard({ tool, index }: ToolCardProps) {
  const Icon = tool.icon as LucideIcon

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.02 }}
    >
      <Link
        to={tool.route}
        className="group flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:border-[#1A73E8] hover:shadow-md transition-all duration-200 h-full"
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#E8F0FE] flex items-center justify-center group-hover:bg-[#1A73E8] transition-colors duration-200">
          <Icon className="w-5 h-5 text-[#1A73E8] group-hover:text-white transition-colors duration-200" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-gray-900 group-hover:text-[#1A73E8] transition-colors truncate">
            {tool.name}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
            {tool.description}
          </p>
        </div>
      </Link>
    </motion.div>
  )
}
