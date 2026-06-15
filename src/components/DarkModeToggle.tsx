import { useState, useEffect } from "react"

export default function DarkModeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return true
    return localStorage.getItem("theme") !== "light"
  })

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    localStorage.setItem("theme", dark ? "dark" : "light")
  }, [dark])

  return (
    <button onClick={() => setDark(!dark)} aria-label="Toggle dark mode"
      className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-sm">
      {dark ? "☀️" : "🌙"}
    </button>
  )
}
