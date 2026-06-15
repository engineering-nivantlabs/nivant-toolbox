import { useState } from 'react'
import { Wand2, Loader2, Clock, Users, ChefHat, UtensilsCrossed, Leaf, Beef, WheatOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ToolLayout from '@/components/ToolLayout'

const dietaryOptions = [
  { id: 'vegetarian', label: 'Vegetarian', icon: Leaf },
  { id: 'vegan', label: 'Vegan', icon: Leaf },
  { id: 'gluten-free', label: 'Gluten-Free', icon: WheatOff },
  { id: 'keto', label: 'Keto', icon: Beef },
  { id: 'dairy-free', label: 'Dairy-Free', icon: UtensilsCrossed },
]

interface Recipe {
  title: string
  description: string
  prepTime: string
  cookTime: string
  servings: number
  ingredients: string[]
  steps: string[]
  dietary: string[]
}

const mockRecipes: Recipe[] = [
  {
    title: 'Mediterranean Quinoa Bowl',
    description: 'A fresh and nutritious bowl packed with Mediterranean flavors, perfect for a healthy lunch or dinner.',
    prepTime: '15 min',
    cookTime: '20 min',
    servings: 2,
    dietary: ['Vegetarian', 'Gluten-Free'],
    ingredients: [
      '1 cup quinoa, rinsed',
      '2 cups vegetable broth',
      '1 cucumber, diced',
      '1 cup cherry tomatoes, halved',
      '1/2 red onion, finely chopped',
      '1/3 cup Kalamata olives',
      '1/2 cup crumbled feta cheese',
      '2 tbsp extra virgin olive oil',
      '1 lemon, juiced',
      '1 tsp dried oregano',
      'Salt and pepper to taste',
    ],
    steps: [
      'Cook the quinoa in vegetable broth according to package directions. Let cool slightly.',
      'In a large bowl, combine the cooked quinoa, cucumber, cherry tomatoes, and red onion.',
      'Add the Kalamata olives and gently toss to combine.',
      'In a small bowl, whisk together olive oil, lemon juice, oregano, salt, and pepper.',
      'Pour the dressing over the quinoa mixture and toss well.',
      'Top with crumbled feta cheese and serve immediately, or refrigerate for later.',
    ],
  },
  {
    title: 'Spicy Thai Basil Chicken',
    description: 'A quick and flavorful Thai stir-fry with fresh basil and a perfect balance of sweet, salty, and spicy.',
    prepTime: '10 min',
    cookTime: '15 min',
    servings: 4,
    dietary: ['Dairy-Free', 'Gluten-Free'],
    ingredients: [
      '1.5 lbs ground chicken',
      '4 cloves garlic, minced',
      '2 Thai chilies, sliced',
      '1 red bell pepper, sliced',
      '2 cups fresh Thai basil leaves',
      '3 tbsp soy sauce (or tamari)',
      '1 tbsp oyster sauce',
      '1 tsp fish sauce',
      '1 tsp sugar',
      '2 tbsp vegetable oil',
      'Steamed jasmine rice for serving',
    ],
    steps: [
      'Heat oil in a wok or large skillet over high heat.',
      'Add garlic and Thai chilies, stir-fry for 30 seconds until fragrant.',
      'Add ground chicken, breaking it up with a spatula. Cook until no longer pink.',
      'Add bell pepper and stir-fry for 2 minutes until slightly softened.',
      'Mix soy sauce, oyster sauce, fish sauce, and sugar in a small bowl.',
      'Pour the sauce over the chicken and stir to coat evenly.',
      'Remove from heat and stir in fresh basil leaves until wilted.',
      'Serve immediately over steamed jasmine rice.',
    ],
  },
  {
    title: 'Creamy Mushroom Risotto',
    description: 'A rich and creamy Italian classic with earthy mushrooms and perfectly cooked arborio rice.',
    prepTime: '10 min',
    cookTime: '35 min',
    servings: 4,
    dietary: ['Vegetarian', 'Gluten-Free'],
    ingredients: [
      '1.5 cups arborio rice',
      '8 oz mixed mushrooms, sliced',
      '1 small onion, finely diced',
      '3 cloves garlic, minced',
      '4 cups warm vegetable broth',
      '1/2 cup dry white wine',
      '1/3 cup grated Parmesan cheese',
      '2 tbsp butter',
      '1 tbsp olive oil',
      'Fresh thyme sprigs',
      'Salt and pepper to taste',
    ],
    steps: [
      'Heat olive oil and 1 tbsp butter in a large pan over medium heat.',
      'Saut\u00e9 mushrooms until golden, about 5 minutes. Remove and set aside.',
      'In the same pan, saut\u00e9 onion until translucent, then add garlic for 30 seconds.',
      'Add arborio rice and toast for 2 minutes, stirring constantly.',
      'Pour in white wine and stir until fully absorbed.',
      'Add warm broth one ladle at a time, stirring frequently. Wait for each addition to absorb before adding more.',
      'When rice is creamy and al dente (about 20 minutes), stir in remaining butter, Parmesan, and mushrooms.',
      'Season with salt, pepper, and fresh thyme. Serve hot.',
    ],
  },
]

export default function RecipeCreator() {
  const [ingredients, setIngredients] = useState('')
  const [selectedDietary, setSelectedDietary] = useState<string[]>([])
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(false)

  const toggleDietary = (id: string) => {
    setSelectedDietary((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    )
  }

  const handleGenerate = () => {
    setLoading(true)
    setRecipe(null)
    setTimeout(() => {
      const randomRecipe = mockRecipes[Math.floor(Math.random() * mockRecipes.length)]
      setRecipe(randomRecipe)
      setLoading(false)
    }, 1800)
  }

  return (
    <ToolLayout
      title="Recipe Creator"
      description="Enter ingredients you have and dietary preferences to generate a custom recipe."
    >
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Available Ingredients
          </label>
          <textarea
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            placeholder="e.g. chicken, rice, bell peppers, soy sauce..."
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:border-transparent resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Dietary Preferences</label>
          <div className="flex flex-wrap gap-2">
            {dietaryOptions.map((opt) => {
              const Icon = opt.icon
              const active = selectedDietary.includes(opt.id)
              return (
                <button
                  key={opt.id}
                  onClick={() => toggleDietary(opt.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                    active
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {opt.label}
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
              Creating your recipe...
            </>
          ) : (
            <>
              <ChefHat className="w-4 h-4" />
              Generate Recipe
            </>
          )}
        </Button>

        {recipe && (
          <div className="mt-6 space-y-5">
            {/* Recipe Header */}
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-gray-900">{recipe.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{recipe.description}</p>
              <div className="flex flex-wrap gap-4 mt-3">
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Clock className="w-4 h-4" />
                  Prep: {recipe.prepTime}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Clock className="w-4 h-4" />
                  Cook: {recipe.cookTime}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Users className="w-4 h-4" />
                  {recipe.servings} servings
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {recipe.dietary.map((d) => (
                  <span key={d} className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    {d}
                  </span>
                ))}
              </div>
            </div>

            {/* Ingredients */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <UtensilsCrossed className="w-4 h-4" />
                Ingredients
              </h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                    {ing}
                  </li>
                ))}
              </ul>
            </div>

            {/* Steps */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <ChefHat className="w-4 h-4" />
                Instructions
              </h4>
              <ol className="space-y-3">
                {recipe.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-semibold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm text-gray-700 leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  )
}
