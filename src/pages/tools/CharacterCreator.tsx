import { useState } from 'react'
import { Wand2, Loader2, User, Sword, Brain, Heart, Star, Shield, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ToolLayout from '@/components/ToolLayout'

const genres = ['Fantasy', 'Sci-Fi', 'Mystery', 'Horror', 'Romance', 'Historical', 'Superhero', 'Cyberpunk']
const roles = ['Protagonist', 'Villain', 'Mentor', 'Sidekick', 'Anti-Hero', 'Comic Relief', 'Rogue', 'Leader']
const traits = ['Brave', 'Cunning', 'Loyal', 'Mysterious', 'Charismatic', 'Reckless', 'Wise', 'Ambitious', 'Kind', 'Ruthless']

interface Character {
  name: string
  genre: string
  role: string
  traits: string[]
  age: string
  appearance: string
  personality: string
  backstory: string
  motivation: string
  quote: string
}

const firstNames: Record<string, string[]> = {
  Fantasy: ['Aldric', 'Lyra', 'Thorne', 'Elara', 'Kael', 'Seraphina'],
  'Sci-Fi': ['Nova', 'Zephyr', 'Orion', 'Lyra-7', 'Kaelen', 'Xara'],
  Mystery: ['Arthur', 'Vivian', 'Silas', 'Clara', 'Edmund', 'Iris'],
  Horror: ['Damien', 'Raven', 'Silas', 'Morgana', 'Victor', 'Lilith'],
  Romance: ['Julian', 'Isabella', 'Oliver', 'Sophia', 'Ethan', 'Amelia'],
  Historical: ['Edward', 'Catherine', 'William', 'Eleanor', 'Henry', 'Margaret'],
  Superhero: ['Max', 'Stella', 'Leo', 'Aurora', 'Felix', 'Iris'],
  Cyberpunk: ['Neo', 'Chrome', 'Pixel', 'Vex', 'Echo', 'Nyx'],
}

const lastNames = ['Blackwood', 'Storm', 'Moonwhisper', 'Ironheart', 'Shadowveil', 'Brightstar', 'Frost', 'Dawnbringer']

function generateCharacter(genre: string, role: string, selectedTraits: string[]): Character {
  const names = firstNames[genre] || firstNames.Fantasy
  const first = names[Math.floor(Math.random() * names.length)]
  const last = lastNames[Math.floor(Math.random() * lastNames.last)]
  const name = `${first} ${last}`

  const appearances: Record<string, string[]> = {
    Fantasy: ['tall with silver hair and piercing blue eyes', 'petite with wild red curls and freckles', 'broad-shouldered with a scar across the left cheek'],
    'Sci-Fi': ['athletic build with cybernetic enhancements on the left arm', 'slender with glowing neural implants along the temples', 'imposing figure in a worn exosuit'],
    Mystery: ['sharp features behind wire-rimmed glasses', 'elegant posture with meticulously groomed dark hair', 'unassuming appearance with observant gray eyes'],
    Horror: ['pale complexion with dark circles under haunted eyes', 'unnaturally perfect smile and cold, calculating gaze', 'disheveled appearance with twitching fingers'],
    Romance: ['warm brown eyes and a gentle, inviting smile', 'striking jawline and windswept golden hair', 'soft features radiating kindness and warmth'],
  }
  const genreAppearances = appearances[genre] || appearances.Fantasy
  const appearance = genreAppearances[Math.floor(Math.random() * genreAppearances.length)]

  const personalities: Record<string, string[]> = {
    Protagonist: ['driven by an unshakeable moral compass', 'reluctantly thrust into greatness', 'burning with determination to right wrongs'],
    Villain: ['charming on the surface but ruthlessly calculating', 'twisted by past trauma into seeking vengeance', 'believes the ends always justify the means'],
    Mentor: ['patient and wise, speaks in riddles and parables', 'hides deep pain behind a facade of calm guidance', 'sees potential in others that they cannot see themselves'],
    Sidekick: ['fiercely loyal with a quick wit', 'constantly underestimated but always delivers', 'brings humor to even the darkest moments'],
    'Anti-Hero': ['walks the line between right and wrong', 'driven by personal gain but occasionally does good', 'cynical worldview shaped by harsh experiences'],
  }
  const rolePersonalities = personalities[role] || personalities.Protagonist
  const personality = rolePersonalities[Math.floor(Math.random() * rolePersonalities.length)]

  const backstories: Record<string, string[]> = {
    Fantasy: ['was orphaned when dragons destroyed their village, raised by forest druids', 'discovered a forbidden tome in the royal library that changed everything', 'trained from childhood in an ancient martial order'],
    'Sci-Fi': ['grew up on a dying space station, learning to survive by any means', 'was a test subject in illegal neural enhancement experiments', 'defected from a megacorp after uncovering dark secrets'],
    Mystery: ['spent years as a journalist before a personal case consumed them', 'retired from the police force after a case that was never solved', 'inherited a detective agency from a legendary relative'],
    Horror: ['survived an encounter with something unspeakable as a child', 'moved to a quiet town unaware of its dark history', 'inherited an ancient mansion with a terrible legacy'],
  }
  const genreBackstories = backstories[genre] || backstories.Fantasy
  const backstory = genreBackstories[Math.floor(Math.random() * genreBackstories.length)]

  const motivations = [
    'seeking redemption for a past mistake',
    'searching for a lost family member',
    'trying to prevent a prophecy from coming true',
    'driven by revenge against a powerful enemy',
    'protecting the innocent from forces beyond their understanding',
    'chasing the truth behind a lifelong mystery',
  ]
  const motivation = motivations[Math.floor(Math.random() * motivations.length)]

  const quotes: Record<string, string[]> = {
    Protagonist: ['I may not be the hero you wanted, but I\'m the one you\'ve got.', 'Some things are worth fighting for, no matter the cost.'],
    Villain: ['You call me a monster, but I am merely the mirror of your own making.', 'Peace is an illusion maintained by those with power.'],
    Mentor: ['The path you seek is not found in books, but in the choices you make.', 'Wisdom is knowing how little you truly know.'],
    Sidekick: ['I\'ve got your back, even when you\'re being an idiot.', 'Behind every great hero is an exhausted best friend.'],
    'Anti-Hero': ['I don\'t do noble. I do necessary.', 'Save the world? Fine. But I\'m getting paid.'],
  }
  const roleQuotes = quotes[role] || quotes.Protagonist
  const quote = roleQuotes[Math.floor(Math.random() * roleQuotes.length)]

  return {
    name,
    genre,
    role,
    traits: selectedTraits.length > 0 ? selectedTraits : [traits[Math.floor(Math.random() * traits.length)]],
    age: `${20 + Math.floor(Math.random() * 40)}`,
    appearance,
    personality,
    backstory,
    motivation,
    quote,
  }
}

export default function CharacterCreator() {
  const [genre, setGenre] = useState('Fantasy')
  const [role, setRole] = useState('Protagonist')
  const [selectedTraits, setSelectedTraits] = useState<string[]>([])
  const [character, setCharacter] = useState<Character | null>(null)
  const [loading, setLoading] = useState(false)

  const toggleTrait = (trait: string) => {
    setSelectedTraits((prev) => {
      if (prev.includes(trait)) return prev.filter((t) => t !== trait)
      if (prev.length >= 3) return prev
      return [...prev, trait]
    })
  }

  const handleGenerate = () => {
    setLoading(true)
    setCharacter(null)
    setTimeout(() => {
      setCharacter(generateCharacter(genre, role, selectedTraits))
      setLoading(false)
    }, 1500)
  }

  return (
    <ToolLayout
      title="Character Creator"
      description="Generate detailed character profiles for stories, games, and RPGs."
    >
      <div className="space-y-6">
        {/* Genre */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Genre</label>
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => (
              <button
                key={g}
                onClick={() => setGenre(g)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  genre === g
                    ? 'bg-[#1A73E8] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  role === r
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Traits */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Personality Traits <span className="text-gray-400 font-normal">(up to 3)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {traits.map((t) => {
              const active = selectedTraits.includes(t)
              return (
                <button
                  key={t}
                  onClick={() => toggleTrait(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    active
                      ? 'border-[#1A73E8] bg-[#E8F0FE] text-[#1A73E8]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {t}
                </button>
              )
            })}
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full bg-[#1A73E8] hover:bg-[#1557B0] text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating character...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Character
            </>
          )}
        </Button>

        {/* Character Card */}
        {character && (
          <div className="mt-6 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-100 rounded-xl p-6">
            {/* Name & Role */}
            <div className="text-center mb-5">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                <User className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">{character.name}</h3>
              <div className="flex items-center justify-center gap-2 mt-1.5">
                <span className="px-2.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                  {character.role}
                </span>
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                  {character.genre}
                </span>
                <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                  Age {character.age}
                </span>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                {character.traits.map((t) => (
                  <span key={t} className="flex items-center gap-0.5 text-xs text-amber-600">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <User className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-gray-500">Appearance</p>
                  <p className="text-sm text-gray-700">{character.appearance}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Brain className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-gray-500">Personality</p>
                  <p className="text-sm text-gray-700">{character.personality}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <BookOpen className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-gray-500">Backstory</p>
                  <p className="text-sm text-gray-700">{character.name.split(' ')[0]} {character.backstory}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Heart className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-gray-500">Motivation</p>
                  <p className="text-sm text-gray-700">Currently {character.motivation}.</p>
                </div>
              </div>
              <div className="bg-white/70 rounded-lg p-3 mt-3">
                <p className="text-sm text-purple-700 italic text-center">&ldquo;{character.quote}&rdquo;</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  )
}

function BookOpen(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}
