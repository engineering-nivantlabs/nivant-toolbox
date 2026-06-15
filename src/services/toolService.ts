const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY

type ToolType = "essay" | "recipe" | "code" | "image" | "business-name" | "password" | "character" | "summary"

interface ToolResult { output: string; tokens_used?: number }

const TOOL_PROMPTS: Record<ToolType, string> = {
  essay: "Write a well-structured essay on the following topic:",
  recipe: "Create a detailed recipe including ingredients, steps, prep time, and cook time for:",
  code: "Explain the following code clearly and thoroughly:",
  image: "Generate a detailed image description for:",
  "business-name": "Generate 10 creative business name ideas for:",
  password: "This is handled client-side",
  character: "Create a detailed fictional character profile based on:",
  summary: "Summarize the following text concisely while keeping key points:",
}

export async function executeTool(tool: ToolType, input: string): Promise<ToolResult> {
  if (tool === "password") {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    const password = Array.from({ length: 20 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
    return { output: password }
  }

  if (!OPENAI_KEY) {
    return { output: `[Demo Mode] This is a mock response for "${tool}" with input: "${input.slice(0, 50)}...". Connect your OpenAI API key for real results.` }
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful AI assistant. Provide high-quality, detailed responses." },
        { role: "user", content: `${TOOL_PROMPTS[tool]}\n\n${input}` },
      ],
      temperature: 0.7,
    }),
  })

  const data = await res.json()
  return {
    output: data.choices[0].message.content,
    tokens_used: data.usage?.total_tokens,
  }
}
