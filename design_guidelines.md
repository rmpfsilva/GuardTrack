# Security Guard Shift Scheduling System - Design Guidelines

## Design Approach

**Selected Approach**: Design System - Professional Enterprise Application  
**Inspiration**: Linear (for clean data presentation), Asana (task management clarity), and Material Design principles  
**Rationale**: This is a utility-focused productivity tool requiring clear information hierarchy, efficient data entry, and reliable mobile/desktop experiences for security operations.

**Core Design Principles**:
- Clarity over decoration - information must be instantly readable
- Trust and reliability - visual design conveys professional security operations
- Efficient workflows - minimize clicks for frequent check-in/check-out actions
- Mobile-first for guards, data-rich for admins

---

## Color Palette

**Light Mode**:
- Primary Brand: 220 70% 50% (professional blue - trust, security)
- Primary Hover: 220 70% 45%
- Surface Background: 0 0% 98%
- Card Background: 0 0% 100%
- Border: 220 20% 90%
- Text Primary: 220 15% 20%
- Text Secondary: 220 10% 50%
- Success (Clocked In): 142 70% 45%
- Warning (Late/Issue): 38 92% 50%
- Error (Missed): 0 72% 51%

**Dark Mode**:
- Primary Brand: 220 70% 55%
- Primary Hover: 220 70% 60%
- Surface Background: 220 15% 10%
- Card Background: 220 12% 14%
- Border: 220 15% 25%
- Text Primary: 220 10% 95%
- Text Secondary: 220 10% 65%
- Success: 142 65% 50%
- Warning: 38 85% 55%
- Error: 0 65% 55%

---

## Typography

**Font Families**:
- Primary: 'Inter' (Google Fonts) - clean, professional, excellent readability
- Monospace: 'JetBrains Mono' - for time stamps and numerical data

**Type Scale**:
- Hero/Dashboard Title: 2.5rem (40px), font-weight 700
- Section Headers: 1.75rem (28px), font-weight 600
- Card Titles: 1.25rem (20px), font-weight 600
- Body Text: 1rem (16px), font-weight 400
- Small/Meta: 0.875rem (14px), font-weight 400
- Time Displays: 1.125rem (18px), font-weight 500, monospace

---

## Layout System

**Spacing Primitives**: Use Tailwind units of **2, 4, 6, 8, 12, 16, 20, 24** consistently  
- Component padding: p-4 to p-6 for cards
- Section spacing: py-12 to py-20 for page sections
- Element gaps: gap-4 for grids, gap-6 for larger layouts
- Button padding: px-6 py-3 for primary actions

**Grid System**:
- Desktop Admin Dashboard: 12-column grid with max-w-7xl container
- Mobile Guard Interface: Single column, full-width with px-4 margins
- Card Layouts: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 for site cards

**Breakpoints**:
- Mobile: base (320px+)
- Tablet: md (768px+)
- Desktop: lg (1024px+)
- Wide: xl (1280px+)

---

## Component Library

### Navigation
**Admin Navigation**: Top horizontal nav bar with logo left, user profile right, main navigation center. Height: h-16, sticky positioning, subtle shadow on scroll.

**Guard Mobile Nav**: Bottom tab bar for quick access (Check In, Schedule, Profile). Height: h-16, fixed bottom, elevated with shadow.

### Authentication
**Login Screen**: Centered card (max-w-md), company logo at top, clean form fields, prominent "Sign In" button. Background: subtle gradient or security-themed abstract pattern.

### Guard Check-In Interface
**Quick Action Card**: Large, prominent card taking 80% of mobile viewport. Contains:
- Current time (large, monospace)
- Site selector (dropdown with search)
- Status indicator (currently clocked in/out)
- Primary action button (full-width, h-14, bold text)

**Status Badge**: Pill-shaped, with dot indicator. Green for active, gray for off-duty.

### Admin Dashboard

**Stats Cards Grid**: 4-column on desktop (2 on tablet, 1 on mobile)
- Total Guards On Duty (green accent)
- Sites Covered (blue accent)
- Pending Check-ins (yellow accent)
- Weekly Hours Total (neutral)

Each card: p-6, rounded-xl, shadow-sm, with icon, large number (2.5rem), and label.

**Live Activity Feed**: Card with scrollable list, h-96 on desktop
- Each entry: time stamp (left), guard name, site, action (clocked in/out)
- Alternating subtle background colors for readability
- Real-time update indicator (pulse animation)

**Site Management Panel**: Table view with columns: Site Name, Address, Active Guards, Actions (Edit/Delete icons). Alternating row colors, hover states.

**Guard Directory**: Card grid layout showing guard profiles
- Avatar (or initials circle), name, current status, total weekly hours
- Click to expand full shift history

### Forms
**Input Fields**: 
- Height: h-12
- Border: 2px solid border color
- Focus state: ring-2 ring-primary
- Labels: above field, text-sm font-medium
- Consistent dark mode support with proper contrast

**Dropdowns/Selects**: Custom styled to match input fields, with chevron icon indicator

**Buttons**:
- Primary: Solid fill, px-6 py-3, rounded-lg, font-semibold
- Secondary: Outline variant with 2px border
- Danger: Red background for delete actions
- Icon buttons: Square (h-10 w-10) for compact actions

### Data Display
**Time Cards**: Display shift times in monospace font with clear in/out labels. Group by day with subtle dividers.

**Weekly Summary Table**: Clean table with headers (bg-surface), data rows, and totals row (font-weight 600). Sticky header on scroll.

**Site Cards**: Visual cards showing site name, address (truncated), and guard count badge. Hover elevation effect.

### Overlays
**Modals**: Centered, max-w-lg, with backdrop blur. Title at top, content area, action buttons at bottom (Cancel left, Confirm right).

**Toast Notifications**: Top-right positioning, slide-in animation, auto-dismiss after 4s. Color-coded by type (success, error, info).

---

## Animations

**Minimal & Purposeful**:
- Button hover: subtle scale (1.02) and brightness shift - 150ms
- Card hover: elevation increase via shadow - 200ms
- Page transitions: fade-in only - 300ms
- Loading states: Simple spinner or skeleton screens
- Real-time updates: Subtle highlight flash on new data - 500ms

**Avoid**: Excessive motion, scroll-triggered animations, complex transitions

---

## Images

**No hero images required** - this is a utility application focused on functionality.

**Profile Avatars**: Circular, 40px for list views, 80px for profile pages. Use initials on colored background if no photo uploaded.

**Empty States**: Simple illustration or icon representing the empty state (e.g., "No active guards" with clipboard icon).

**Icons**: Use Heroicons (outline style) throughout for consistency. Key icons needed:
- Clock (check-in/out)
- Users (guard directory)
- MapPin (sites)
- Calendar (schedule)
- ChartBar (statistics)
- Shield (security theme)

---

## Responsive Behavior

**Mobile Guard Experience** (320px - 767px):
- Large touch targets (min 44px height)
- Bottom navigation for thumb reach
- Check-in button: Full width, sticky at screen bottom when scrolling
- Simplified dashboard with stacked cards

**Desktop Admin Experience** (1024px+):
- Multi-column layouts for data density
- Sidebar navigation option for admin tools
- Data tables with horizontal scroll if needed
- Multi-panel views (list + detail)