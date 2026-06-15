import {
  PenTool, Image, FileText, Sparkles, Briefcase, Code, Palette,
  Wrench, Type, BookOpen, Mail, FileEdit, MessageSquare, Megaphone,
  Camera, Eraser, Wand2, Paintbrush, ThumbsUp, Laugh, Music,
  UtensilsCrossed, Moon, Star, HelpCircle, Flame, Lightbulb,
  ClipboardList, BarChart3, TrendingUp, Bug, Database, GitBranch,
  Globe, Key, QrCode, ArrowLeftRight, Braces, Table, Copy,
  Shield, Layers, Zap, Heart, Eye, Search, Trash2, ScanText,
  Languages, Hash, AlignLeft, CheckCircle, XCircle, ChevronRight,
  Atom, Clock, Gamepad2, User, Rocket, Crown, Settings
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface Tool {
  id: string
  name: string
  description: string
  category: string
  icon: LucideIcon
  route: string
  featured?: boolean
}

export const categories = [
  'All',
  'Writing',
  'Image',
  'Text',
  'Fun',
  'Business',
  'Code',
  'Creative',
  'Utility',
] as const

export type Category = (typeof categories)[number]

export const tools: Tool[] = [
  // Writing
  { id: 'essay-writer', name: 'Essay Writer', description: 'Generate well-structured essays on any topic in seconds.', category: 'Writing', icon: PenTool, route: '/tools/essay-writer', featured: true },
  { id: 'story-generator', name: 'Story Generator', description: 'Create compelling short stories with unique plots and characters.', category: 'Writing', icon: BookOpen, route: '/tools/story-generator' },
  { id: 'blog-ideas', name: 'Blog Ideas', description: 'Get fresh blog post ideas and outlines tailored to your niche.', category: 'Writing', icon: Lightbulb, route: '/tools/blog-ideas' },
  { id: 'email-writer', name: 'Email Writer', description: 'Craft professional and persuasive emails for any occasion.', category: 'Writing', icon: Mail, route: '/tools/email-writer' },
  { id: 'resume-builder', name: 'Resume Builder', description: 'Build a polished resume with AI-powered suggestions.', category: 'Writing', icon: FileEdit, route: '/tools/resume-builder' },
  { id: 'cover-letter', name: 'Cover Letter', description: 'Generate personalized cover letters that stand out.', category: 'Writing', icon: FileText, route: '/tools/cover-letter' },
  { id: 'social-posts', name: 'Social Posts', description: 'Create engaging social media posts for all platforms.', category: 'Writing', icon: MessageSquare, route: '/tools/social-posts' },
  { id: 'ad-copy', name: 'Ad Copy', description: 'Write high-converting advertisement copy in seconds.', category: 'Writing', icon: Megaphone, route: '/tools/ad-copy' },
  { id: 'product-description', name: 'Product Description', description: 'Generate compelling product descriptions for e-commerce.', category: 'Writing', icon: ClipboardList, route: '/tools/product-description' },
  { id: 'press-release', name: 'Press Release', description: 'Write professional press releases for announcements.', category: 'Writing', icon: Megaphone, route: '/tools/press-release' },

  // Image
  { id: 'ai-image-generator', name: 'AI Image Gen', description: 'Generate stunning images from text prompts using AI.', category: 'Image', icon: Image, route: '/tools/ai-image-generator', featured: true },
  { id: 'background-remover', name: 'Background Remover', description: 'Remove backgrounds from photos automatically.', category: 'Image', icon: Eraser, route: '/tools/background-remover' },
  { id: 'photo-enhancer', name: 'Photo Enhancer', description: 'Upscale and enhance image quality with AI.', category: 'Image', icon: Camera, route: '/tools/photo-enhancer' },
  { id: 'colorizer', name: 'Colorizer', description: 'Colorize black and white photos with realistic colors.', category: 'Image', icon: Palette, route: '/tools/colorizer' },
  { id: 'thumbnail-maker', name: 'Thumbnail Maker', description: 'Create eye-catching thumbnails for videos.', category: 'Image', icon: Image, route: '/tools/thumbnail-maker' },
  { id: 'logo-generator', name: 'Logo Generator', description: 'Design unique logos for your brand or business.', category: 'Image', icon: Sparkles, route: '/tools/logo-generator' },
  { id: 'meme-maker', name: 'Meme Maker', description: 'Generate hilarious memes with custom captions.', category: 'Image', icon: Laugh, route: '/tools/meme-maker' },
  { id: 'style-transfer', name: 'Style Transfer', description: 'Apply artistic styles to your photographs.', category: 'Image', icon: Paintbrush, route: '/tools/style-transfer' },

  // Text
  { id: 'summarizer', name: 'Summarizer', description: 'Condense long articles into concise summaries.', category: 'Text', icon: ScanText, route: '/tools/summarizer', featured: true },
  { id: 'paraphraser', name: 'Paraphraser', description: 'Rewrite text in a different style while keeping meaning.', category: 'Text', icon: Type, route: '/tools/paraphraser' },
  { id: 'grammar-fix', name: 'Grammar Fix', description: 'Correct grammar, spelling, and punctuation errors.', category: 'Text', icon: CheckCircle, route: '/tools/grammar-fix' },
  { id: 'translator', name: 'Translator', description: 'Translate text between 50+ languages accurately.', category: 'Text', icon: Globe, route: '/tools/translator' },
  { id: 'keyword-extractor', name: 'Keyword Extractor', description: 'Extract important keywords from any text.', category: 'Text', icon: Hash, route: '/tools/keyword-extractor' },
  { id: 'sentiment-analyzer', name: 'Sentiment Analyzer', description: 'Analyze the emotional tone of any text.', category: 'Text', icon: Heart, route: '/tools/sentiment-analyzer' },
  { id: 'plagiarism-check', name: 'Plagiarism Check', description: 'Check text for originality and potential plagiarism.', category: 'Text', icon: Search, route: '/tools/plagiarism-check' },
  { id: 'diff-checker', name: 'Diff Checker', description: 'Compare two texts and highlight differences.', category: 'Text', icon: ArrowLeftRight, route: '/tools/diff-checker' },

  // Fun
  { id: 'joke-generator', name: 'Joke Generator', description: 'Generate funny jokes on any topic or category.', category: 'Fun', icon: Laugh, route: '/tools/joke-generator' },
  { id: 'poem-writer', name: 'Poem Writer', description: 'Create beautiful poems in various styles and forms.', category: 'Fun', icon: PenTool, route: '/tools/poem-writer' },
  { id: 'song-lyrics', name: 'Song Lyrics', description: 'Write original song lyrics in any genre.', category: 'Fun', icon: Music, route: '/tools/song-lyrics' },
  { id: 'recipe-creator', name: 'Recipe Creator', description: 'Create recipes from ingredients you have on hand.', category: 'Fun', icon: UtensilsCrossed, route: '/tools/recipe-creator', featured: true },
  { id: 'dream-interpreter', name: 'Dream Interpreter', description: 'Get AI interpretations of your dreams.', category: 'Fun', icon: Moon, route: '/tools/dream-interpreter' },
  { id: 'horoscope', name: 'Horoscope', description: 'Generate personalized daily horoscopes.', category: 'Fun', icon: Star, route: '/tools/horoscope' },
  { id: 'riddle-maker', name: 'Riddle Maker', description: 'Create brain-teasing riddles with answers.', category: 'Fun', icon: HelpCircle, route: '/tools/riddle-maker' },
  { id: 'insult-generator', name: 'Insult Generator', description: 'Generate playful, creative insults and roasts.', category: 'Fun', icon: Flame, route: '/tools/insult-generator' },

  // Business
  { id: 'business-name-gen', name: 'Business Name Gen', description: 'Generate catchy business names with domain checks.', category: 'Business', icon: Briefcase, route: '/tools/business-name-generator', featured: true },
  { id: 'slogan-maker', name: 'Slogan Maker', description: 'Create memorable slogans and taglines.', category: 'Business', icon: Megaphone, route: '/tools/slogan-maker' },
  { id: 'invoice-generator', name: 'Invoice Generator', description: 'Generate professional invoices instantly.', category: 'Business', icon: FileText, route: '/tools/invoice-generator' },
  { id: 'contract-writer', name: 'Contract Writer', description: 'Draft basic contracts and agreements.', category: 'Business', icon: FileEdit, route: '/tools/contract-writer' },
  { id: 'pitch-deck', name: 'Pitch Deck', description: 'Generate pitch deck outlines and content.', category: 'Business', icon: BarChart3, route: '/tools/pitch-deck' },
  { id: 'swot-analysis', name: 'SWOT Analysis', description: 'Create comprehensive SWOT analyses.', category: 'Business', icon: Layers, route: '/tools/swot-analysis' },
  { id: 'financial-forecast', name: 'Financial Forecast', description: 'Generate financial projections and forecasts.', category: 'Business', icon: TrendingUp, route: '/tools/financial-forecast' },

  // Code
  { id: 'code-explainer', name: 'Code Explainer', description: 'Get step-by-step explanations of any code.', category: 'Code', icon: Code, route: '/tools/code-explainer', featured: true },
  { id: 'bug-fixer', name: 'Bug Fixer', description: 'Identify and fix bugs in your code.', category: 'Code', icon: Bug, route: '/tools/bug-fixer' },
  { id: 'regex-builder', name: 'Regex Builder', description: 'Build and test regular expressions easily.', category: 'Code', icon: Search, route: '/tools/regex-builder' },
  { id: 'sql-generator', name: 'SQL Generator', description: 'Generate SQL queries from natural language.', category: 'Code', icon: Database, route: '/tools/sql-generator' },
  { id: 'api-mock-gen', name: 'API Mock Gen', description: 'Generate mock API responses for testing.', category: 'Code', icon: Zap, route: '/tools/api-mock-generator' },
  { id: 'code-converter', name: 'Code Converter', description: 'Convert code between programming languages.', category: 'Code', icon: ArrowLeftRight, route: '/tools/code-converter' },
  { id: 'git-commit-msg', name: 'Git Commit Msg', description: 'Generate meaningful git commit messages.', category: 'Code', icon: GitBranch, route: '/tools/git-commit-msg' },

  // Creative
  { id: 'character-creator', name: 'Character Creator', description: 'Create detailed character profiles for stories and games.', category: 'Creative', icon: User, route: '/tools/character-creator', featured: true },
  { id: 'world-builder', name: 'World Builder', description: 'Build immersive fictional worlds with lore.', category: 'Creative', icon: Globe, route: '/tools/world-builder' },
  { id: 'plot-generator', name: 'Plot Generator', description: 'Generate unique story plots and twists.', category: 'Creative', icon: BookOpen, route: '/tools/plot-generator' },
  { id: 'dialogue-writer', name: 'Dialogue Writer', description: 'Write natural dialogue between characters.', category: 'Creative', icon: MessageSquare, route: '/tools/dialogue-writer' },
  { id: 'scene-description', name: 'Scene Description', description: 'Create vivid scene descriptions for stories.', category: 'Creative', icon: Eye, route: '/tools/scene-description' },
  { id: 'title-generator', name: 'Title Generator', description: 'Generate catchy titles for books, articles, and more.', category: 'Creative', icon: Type, route: '/tools/title-generator' },

  // Utility
  { id: 'password-gen', name: 'Password Gen', description: 'Generate secure, random passwords.', category: 'Utility', icon: Key, route: '/tools/password-generator', featured: true },
  { id: 'qr-code-maker', name: 'QR Code Maker', description: 'Create QR codes for URLs, text, and more.', category: 'Utility', icon: QrCode, route: '/tools/qr-code-maker' },
  { id: 'unit-converter', name: 'Unit Converter', description: 'Convert between various units of measurement.', category: 'Utility', icon: ArrowLeftRight, route: '/tools/unit-converter' },
  { id: 'json-formatter', name: 'JSON Formatter', description: 'Format, validate, and beautify JSON data.', category: 'Utility', icon: Braces, route: '/tools/json-formatter' },
  { id: 'csv-to-json', name: 'CSV to JSON', description: 'Convert CSV data to JSON format.', category: 'Utility', icon: Table, route: '/tools/csv-to-json' },
  { id: 'lorem-ipsum', name: 'Lorem Ipsum', description: 'Generate placeholder text for designs.', category: 'Utility', icon: AlignLeft, route: '/tools/lorem-ipsum' },
  { id: 'quote-generator', name: 'Quote Generator', description: 'Generate inspirational and motivational quotes.', category: 'Utility', icon: Sparkles, route: '/tools/quote-generator' },
  { id: 'reading-time', name: 'Reading Time', description: 'Estimate reading time for any text.', category: 'Utility', icon: Clock, route: '/tools/reading-time' },
]
