# MediSync Kiosk Design System (Figma -> Tailwind v4)

You are an expert Frontend Engineer. Your goal is to implement pixel-perfect, touch-friendly UI using **React** and **Tailwind CSS v4**.

## 1. Global Styling Strategy (Tailwind v4)
- **Framework:** Use Tailwind CSS v4. Assume a CSS-first configuration.
- **Visual Style:** "Medical Soft UI". Clean, high-contrast, trustworthy.
- **Backgrounds:** NEVER make card/modal backgrounds transparent. Use `bg-white` or `bg-slate-50`.
- **Shadows:** Use soft, diffused shadows for depth. 
  - Preferred: `shadow-xl` or `shadow-[0_8px_30px_rgb(0,0,0,0.04)]`.
- **Rounded Corners:** heavily rounded corners are required for the friendly Kiosk look.
  - Cards/Modals: `rounded-[32px]` or `rounded-3xl`.
  - Buttons/Inputs: `rounded-2xl`.

## 2. Component Defaults (Copy-Paste Ready)
- **Primary Button:** `w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xl h-16 rounded-2xl shadow-lg active:scale-95 transition-all`
- **Secondary Button:**
  `w-full bg-white border-2 border-slate-200 text-slate-700 font-bold text-xl h-16 rounded-2xl hover:bg-slate-50 active:scale-95`
- **Input Fields:**
  `w-full bg-slate-50 border border-slate-200 h-16 rounded-2xl px-6 text-lg focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all`
- **Cards:**
  `bg-white rounded-[32px] p-8 shadow-xl border border-slate-100`

## 3. Kiosk Specifics (Touch Interaction)
- **Touch Targets:** ALL interactive elements must be at least **60px height** (`h-[60px]` or `h-16`).
- **Typography:**
  - Body text: `text-lg` or `text-xl` (minimum for kiosk readability).
  - Headings: `text-3xl` or `text-4xl` font-bold text-slate-800.
- **Layout:**
  - Use Flexbox (`flex flex-col gap-6`) or Grid (`grid grid-cols-12 gap-6`) for structure.
  - Avoid using margins (`m-4`) for spacing between siblings; use `gap` instead.

## 4. Animation & Polish
- **Transitions:** Always add `transition-all duration-200` to interactive elements.
- **Active States:** Always include `active:scale-95` on buttons to give "tactile" feedback on touchscreens.
- **Icons:** Use `lucide-react` icons with `size={24}` or larger.