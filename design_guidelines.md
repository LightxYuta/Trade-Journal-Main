# Trading Journal Enhancement Guidelines

## Project Context
Enhance existing trading journal with **Analytics & Insights** and **Visualization Enhancements** while maintaining 100% design consistency with current implementation.

## Critical Constraint
**Preserve ALL existing design elements exactly as implemented.** No modifications to colors, typography, spacing, components, or visual treatment.

## Existing Design System (Maintain Exactly)

### Color Palette
- Background: `#020202` (main), `#080808` (elevated), `#111111` (soft)
- Borders: `#252525` and `rgba(40, 40, 40, 0.95)`
- Text: `#ffffff` (primary), `#b8b8b8` (soft)
- Accents: Blue `#4fc3f7`, Pink `#ff9ece`, Green `#00d28a`, Red `#ff4f4f`, Gold `#ffd76e`

### Typography
- Font: Inter (400, 500, 600, 700 weights)
- Sizes: 0.63rem–1.1rem with specific hierarchy already established
- Letter-spacing: 0.08em–0.14em for uppercase elements

### Spacing System
- Border radius: `--radius-lg: 18px`, `--radius-xl: 22px`
- Card padding: 14-16px
- Grid gaps: 10-16px
- Component spacing: 6-8px internal gaps

### Component Patterns (Use Existing)
- **Cards**: Radial gradients with `::before` pseudo-element glow effect
- **Buttons**: Pill-shaped (999px radius), 7px-13px padding, with blue/pink accent styles
- **Pills/Chips**: 999px radius, 3-8px padding, border + subtle background
- **Navigation**: Dot indicators with gradient glow on active state

## New Feature Integration Strategy

### Analytics Dashboard Additions
Create new card components following exact existing `.card` structure:
- Equity Curve Chart card
- Performance Breakdown card (time periods)
- Streak Tracker card
- Strategy Comparison card

Use existing `.grid-2`, `.grid-3`, `.grid-4` responsive layouts.

### Visualization Components
**Equity Curve**: Line chart using Chart.js (already included) with gradient fill matching accent colors

**Heat Maps**: Grid-based layout using existing `.chip` styling for cells, color-coded with accent colors (green/red scale)

**Distribution Charts**: Bar/doughnut charts with accent color palette, placed in `.card` containers

**Calendar View**: Grid layout with existing `.small-pill` components, color-coded dots for daily P&L

### Chart Styling Standards
- Background: Transparent or `rgba(8, 8, 8, 0.5)`
- Grid lines: `rgba(37, 37, 37, 0.5)`
- Accent colors from existing palette
- Font: Match existing Inter system
- Tooltips: Use card-style backgrounds with soft shadows

### Metrics Display
Use existing patterns:
- `.page-pill-row` with `.small-pill` for KPI summaries
- `.card-header-row` for metric categories
- Numerical values with appropriate accent color dots

### Responsive Behavior
Maintain existing breakpoints:
- 900px: Sidebar collapse
- 800px: Grid-3 to Grid-2
- 650px: All grids to single column

### Animation Guidelines
Match existing `transition: all 0.18s ease-out` timing
Use existing hover states (translateY, box-shadow patterns)

## Layout Approach
Add new pages/sections following existing `.page` structure with `.page-header`, `.page-title-block`, and card-based content grids. Use dashboard's `.dash-top-grid` pattern for multi-column analytics layouts.

## Implementation Priority
1. Replicate exact gradient formulas, shadow values, and border treatments
2. Use existing component classes without modification
3. Extend with new content, never alter base styles
4. Match pixel-perfect spacing and sizing from current implementation

**No experimentation—strict adherence to established visual language.**