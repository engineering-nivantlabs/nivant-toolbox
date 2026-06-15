import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'

const footerLinks = {
  Tools: [
    { label: 'Essay Writer', href: '/tools/essay-writer' },
    { label: 'AI Image Gen', href: '/tools/ai-image-generator' },
    { label: 'Summarizer', href: '/tools/summarizer' },
    { label: 'Password Gen', href: '/tools/password-generator' },
    { label: 'Code Explainer', href: '/tools/code-explainer' },
    { label: 'View All Tools', href: '/' },
  ],
  Company: [
    { label: 'About Us', href: '/#' },
    { label: 'Blog', href: '/#' },
    { label: 'Careers', href: '/#' },
    { label: 'Contact', href: '/#' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '/#' },
    { label: 'Terms of Service', href: '/#' },
    { label: 'Cookie Policy', href: '/#' },
  ],
  Connect: [
    { label: 'Twitter', href: '/#' },
    { label: 'Discord', href: '/#' },
    { label: 'GitHub', href: '/#' },
  ],
}

export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold text-gray-900 mb-4">{category}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className="text-sm text-gray-500 hover:text-[#1A73E8] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-900">
              BoredHumans<span className="text-[#1A73E8]">.</span>
            </span>
          </div>
          <p className="text-sm text-gray-400">
            &copy; {new Date().getFullYear()} BoredHumans. All rights reserved.
          </p>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            Made with <Sparkles className="w-3 h-3 text-[#1A73E8]" /> AI-powered tools
          </p>
        </div>
      </div>
    </footer>
  )
}
