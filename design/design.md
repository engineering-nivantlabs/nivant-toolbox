# BoredHumans AI Tools Platform — Design Document

---

## Overview

A massive directory of 100+ simple AI tools on a single domain. The design philosophy is ultra-clean, Google-like minimalism — white backgrounds, subtle shadows, blue accent, dense grid layout. Tools are the star. No fluff. Fast, lightweight, utilitarian feel.

---

## Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#FFFFFF` | Page background |
| `--bg-secondary` | `#F8F9FA` | Card backgrounds, sections |
| `--bg-tertiary` | `#F1F3F4` | Input backgrounds, hover states |
| `--text-primary` | `#202124` | Headings, primary text |
| `--text-secondary` | `#5F6368` | Descriptions, secondary text |
| `--text-muted` | `#9AA0A6` | Placeholders, disabled |
| `--accent-primary` | `#1A73E8` | Primary buttons, links, active states |
| `--accent-hover` | `#1557B0` | Button hover |
| `--accent-light` | `#E8F0FE` | Light accent backgrounds |
| `--border-light` | `#DADCE0` | Card borders, dividers |
| `--border-medium` | `#C4C7C5` | Input borders |
| `--success` | `#34A853` | Success states, available |
| `--warning` | `#FBBC04` | Warnings |
| `--danger` | `#EA4335` | Errors, taken |
| `--premium` | `#F9AB00` | Premium badge, gold |

---

## Typography

| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Logo | System Sans | 22px | 700 | `--text-primary` |
| Page Title | System Sans | 28px | 600 | `--text-primary` |
| Section Heading | System Sans | 18px | 600 | `--text-primary` |
| Tool Name | System Sans | 14px | 500 | `--text-primary` |
| Tool Description | System Sans | 12px | 400 | `--text-secondary` |
| Body | System Sans | 14px | 400 | `--text-primary` |
| Small/Label | System Sans | 12px | 500 | `--text-secondary` |

- **Font stack**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Line height**: 1.5 for body, 1.3 for headings

---

## Spacing Scale

| Token | Value |
|-------|-------|
| `xs` | 4px |
| `sm` | 8px |
| `md` | 16px |
| `lg` | 24px |
| `xl` | 32px |
| `2xl` | 48px |
| `3xl` | 64px |

- **Max content width**: 1280px
- **Grid gap**: 16px
- **Card padding**: 16px
- **Section padding**: 24px vertical

---

## Component Design

### Header
- Fixed top, `z-50`, white background, bottom border `1px solid --border-light`
- Height: 60px
- Left: Logo "BoredHumans" with blue dot accent
- Center: Search bar (collapsible on mobile)
- Right: "Premium" CTA button (blue, rounded)

### Category Filter Bar
- Sticky below header, white background
- Horizontal scrollable row of pill buttons
- Categories: All, Writing, Image, Text, Fun, Business, Code, Creative, Utility
- Active: blue background + white text
- Inactive: gray background + dark text
- Padding: 12px vertical

### Tool Card
- White background, rounded-lg (8px), border `1px solid --border-light`
- Hover: subtle shadow `0 2px 8px rgba(0,0,0,0.08)`, border color `--accent-primary`
- Transition: `all 0.2s ease`
- Layout: Icon (40px) + Tool Name + Description (2 lines max)
- Click: navigate to tool page

### Tool Page Layout
- Clean header with back button + tool name
- White card with tool interface (inputs, buttons)
- Output area below
- Minimal chrome — maximum space for the tool

### Footer
- Background: `--bg-secondary`
- 4-column link grid: Tools, Company, Legal, Connect
- Copyright + "Made with" line
- Ad placeholder area

---

## Animation Style

- **Page transitions**: Fade in, 200ms ease-out
- **Card hover**: Scale 1.01, shadow increase, 200ms
- **Button hover**: Background darken, 150ms
- **Tool generation**: Loading spinner + fade-in result, 300ms
- **Stagger**: Grid items stagger 30ms on page load
- **No heavy animations** — this is a utility site, performance is king

---

## Page List

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Massive tool grid with category filters, search |
| Essay Writer | `/tools/essay-writer` | Topic input, word count, tone, generate essay |
| AI Image Generator | `/tools/ai-image-generator` | Prompt, style, size, generate placeholder |
| Text Summarizer | `/tools/summarizer` | Text input, summary length, bullet output |
| Business Name Generator | `/tools/business-name-generator` | Keywords, industry, name ideas + domain check |
| Code Explainer | `/tools/code-explainer` | Code input, language, step-by-step explanation |
| Password Generator | `/tools/password-generator` | Length, char types, real JS generation |
| Recipe Creator | `/tools/recipe-creator` | Ingredients, dietary prefs, full recipe |
| Character Creator | `/tools/character-creator` | Genre, role, personality, character profile |
| Premium | `/premium` | Pricing, feature comparison, upsell |

---

## Shared Components

- `Header` — Logo, search, premium CTA
- `CategoryFilter` — Horizontal pill filters
- `ToolGrid` — Responsive card grid
- `ToolCard` — Individual tool card
- `Footer` — Links, copyright, ad placeholder
- `ToolLayout` — Wrapper for tool pages (back nav, title)

---

## Dependencies

- `lucide-react` — Icons throughout
- `framer-motion` — Page transitions, card animations
- `react-router-dom` — HashRouter routing

---

## Assets

No generated images needed. The site uses:
- Lucide icons for all tool and UI icons
- Gradient placeholders for AI-generated images
- CSS-only visuals — no external assets required
