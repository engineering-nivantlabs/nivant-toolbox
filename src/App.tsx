import { Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Home from '@/pages/Home'
import Premium from '@/pages/Premium'
import EssayWriter from '@/pages/tools/EssayWriter'
import AiImageGenerator from '@/pages/tools/AiImageGenerator'
import TextSummarizer from '@/pages/tools/TextSummarizer'
import BusinessNameGenerator from '@/pages/tools/BusinessNameGenerator'
import CodeExplainer from '@/pages/tools/CodeExplainer'
import PasswordGenerator from '@/pages/tools/PasswordGenerator'
import RecipeCreator from '@/pages/tools/RecipeCreator'
import CharacterCreator from '@/pages/tools/CharacterCreator'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/premium" element={<Premium />} />
        <Route path="/tools/essay-writer" element={<EssayWriter />} />
        <Route path="/tools/ai-image-generator" element={<AiImageGenerator />} />
        <Route path="/tools/summarizer" element={<TextSummarizer />} />
        <Route path="/tools/business-name-generator" element={<BusinessNameGenerator />} />
        <Route path="/tools/code-explainer" element={<CodeExplainer />} />
        <Route path="/tools/password-generator" element={<PasswordGenerator />} />
        <Route path="/tools/recipe-creator" element={<RecipeCreator />} />
        <Route path="/tools/character-creator" element={<CharacterCreator />} />
      </Route>
    </Routes>
  )
}
