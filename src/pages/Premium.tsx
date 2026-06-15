import { Link } from 'react-router-dom'
import { Check, X, Crown, Zap, Shield, Clock, Code, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

const features = [
  { name: 'Access to all 100+ tools', free: true, premium: true },
  { name: 'Basic output length', free: true, premium: true },
  { name: 'Standard speed', free: true, premium: true },
  { name: 'No advertisements', free: false, premium: true },
  { name: 'Extended output (10x longer)', free: false, premium: true },
  { name: 'Priority processing (2x faster)', free: false, premium: true },
  { name: 'Advanced tool settings', free: false, premium: true },
  { name: 'Batch processing (up to 50 items)', free: false, premium: true },
  { name: 'API access', free: false, premium: true },
  { name: 'Export to PDF & Word', free: false, premium: true },
  { name: 'Custom templates', free: false, premium: true },
  { name: '24/7 priority support', free: false, premium: true },
]

export default function Premium() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-medium mb-4">
          <Crown className="w-3 h-3" />
          Upgrade Your Experience
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
          Go <span className="text-[#1A73E8]">Premium</span>
        </h1>
        <p className="text-gray-500 mt-3 max-w-lg mx-auto">
          Unlock the full potential of BoredHumans with faster processing, longer outputs, and advanced features.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-2 gap-6 mb-12">
        {/* Free */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Free</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">Perfect for casual use</p>
          <div className="flex items-baseline gap-1 mb-6">
            <span className="text-3xl font-bold text-gray-900">$0</span>
            <span className="text-sm text-gray-400">/month</span>
          </div>
          <ul className="space-y-2.5 mb-6">
            {features.filter((_, i) => i < 3).map((f) => (
              <li key={f.name} className="flex items-center gap-2 text-sm text-gray-600">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                {f.name}
              </li>
            ))}
            {features.filter((_, i) => i >= 3).slice(0, 4).map((f) => (
              <li key={f.name} className="flex items-center gap-2 text-sm text-gray-400">
                <X className="w-4 h-4 text-gray-300 flex-shrink-0" />
                {f.name}
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            className="w-full py-2.5 rounded-lg border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Current Plan
          </Button>
        </div>

        {/* Premium */}
        <div className="bg-gradient-to-br from-[#1A73E8] to-[#1557B0] rounded-xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-5 h-5 text-amber-300" />
              <h2 className="text-lg font-semibold">Premium</h2>
            </div>
            <p className="text-sm text-blue-100 mb-4">For power users & professionals</p>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-3xl font-bold">$9.99</span>
              <span className="text-sm text-blue-200">/month</span>
            </div>
            <ul className="space-y-2.5 mb-6">
              {features.map((f) => (
                <li key={f.name} className="flex items-center gap-2 text-sm text-blue-50">
                  <Check className="w-4 h-4 text-green-300 flex-shrink-0" />
                  {f.name}
                </li>
              ))}
            </ul>
            <Button className="w-full py-2.5 rounded-lg bg-white text-[#1A73E8] hover:bg-blue-50 font-semibold flex items-center justify-center gap-2">
              <Zap className="w-4 h-4" />
              Upgrade to Premium
            </Button>
          </div>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="grid sm:grid-cols-3 gap-6 mb-12">
        <div className="text-center p-5 bg-gray-50 rounded-xl">
          <div className="w-10 h-10 bg-[#E8F0FE] rounded-lg flex items-center justify-center mx-auto mb-3">
            <Zap className="w-5 h-5 text-[#1A73E8]" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">2x Faster</h3>
          <p className="text-xs text-gray-500 mt-1">Priority processing means you get results in half the time.</p>
        </div>
        <div className="text-center p-5 bg-gray-50 rounded-xl">
          <div className="w-10 h-10 bg-[#E8F0FE] rounded-lg flex items-center justify-center mx-auto mb-3">
            <Shield className="w-5 h-5 text-[#1A73E8]" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">No Ads</h3>
          <p className="text-xs text-gray-500 mt-1">Clean, distraction-free interface. Focus on what matters.</p>
        </div>
        <div className="text-center p-5 bg-gray-50 rounded-xl">
          <div className="w-10 h-10 bg-[#E8F0FE] rounded-lg flex items-center justify-center mx-auto mb-3">
            <Code className="w-5 h-5 text-[#1A73E8]" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">API Access</h3>
          <p className="text-xs text-gray-500 mt-1">Integrate our tools directly into your apps and workflows.</p>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto">
        <h2 className="text-lg font-semibold text-gray-900 text-center mb-6">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {[
            { q: 'Can I cancel anytime?', a: 'Yes, you can cancel your subscription at any time. You\'ll continue to have access until the end of your billing period.' },
            { q: 'Is there a free trial?', a: 'We offer a 7-day free trial for new Premium users. No credit card required to start.' },
            { q: 'What payment methods are accepted?', a: 'We accept all major credit cards, PayPal, and Apple Pay.' },
            { q: 'Can I switch plans later?', a: 'Yes, you can upgrade or downgrade your plan at any time from your account settings.' },
          ].map((faq, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900">{faq.q}</h3>
              <p className="text-sm text-gray-500 mt-1">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center mt-12">
        <Link
          to="/"
          className="text-sm text-[#1A73E8] hover:underline"
        >
          Back to all tools
        </Link>
      </div>
    </div>
  )
}
