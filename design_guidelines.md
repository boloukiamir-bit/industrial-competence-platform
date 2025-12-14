# Design Guidelines: Industrial Competence Platform

## Design Approach

**Selected Framework:** Carbon Design System (IBM) adapted for industrial/enterprise context
**Rationale:** This platform serves B2B users managing competencies, certifications, and training. Carbon excels at data-heavy, enterprise applications while maintaining modern visual appeal.

**Design Principles:**
- Professional credibility with modern edge
- Information clarity over decoration
- Purposeful hierarchy for complex data
- Trust-building through structured layouts

## Typography

**Font Stack:**
- **Primary:** Inter (Google Fonts) - headings, UI elements, navigation
- **Secondary:** IBM Plex Sans (Google Fonts) - body text, data tables

**Type Scale:**
- Hero Headlines: text-5xl md:text-6xl lg:text-7xl, font-bold
- Section Headers: text-3xl md:text-4xl, font-semibold
- Subsections: text-xl md:text-2xl, font-medium
- Body Large: text-lg, font-normal
- Body: text-base, font-normal
- Captions/Labels: text-sm, font-medium
- Small/Meta: text-xs, font-normal

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 8, 12, 16, 20, 24 for consistent rhythm
- Component internal spacing: p-4, p-6, p-8
- Section spacing: py-16 md:py-20 lg:py-24
- Element gaps: gap-4, gap-6, gap-8
- Container padding: px-4 md:px-6 lg:px-8

**Grid System:**
- Maximum content width: max-w-7xl mx-auto
- Multi-column grids: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Form layouts: max-w-2xl for optimal input width

## Landing Page Structure

### Hero Section
**Layout:** Asymmetric split - 60/40 content-to-visual ratio
- Left: Headline + subheadline + dual CTA buttons
- Right: Large hero image showing industrial/training environment
- Height: min-h-[600px] lg:min-h-[700px]
- Background: Subtle gradient or geometric pattern overlay

**Hero Image:** Professional photo depicting industrial training, competency assessment, or team collaboration in manufacturing/technical setting. Image should convey professionalism and capability.

### Trust Indicators Section
Immediately below hero, compact strip showcasing:
- "Trusted by X+ companies" metric
- 3-4 client logos (grayscale, equal sizing)
- Industry certifications or compliance badges
- Height: py-12, contained width

### Core Value Proposition (3 Columns)
**Layout:** Three-column grid featuring key platform benefits
- Icon + headline + description format
- Icons: Use Font Awesome Pro industrial/business icons (fa-industry, fa-certificate, fa-chart-line)
- Card treatment: Subtle border, no shadow, clean separation
- Spacing: gap-8 lg:gap-12

### Feature Showcase (Alternating Rows)
**Layout:** Two-row alternating image-content split
- Row 1: Image left, content right (Competency Management)
- Row 2: Content left, image right (Certification Tracking)
- Each row: Full-width container with internal grid
- Images: Screenshots or diagrams of platform features with professional framing

**Feature Images:** Clean UI screenshots showing dashboard, certification management, or competency matrix views.

### Statistics/Impact Section
**Layout:** Four-column metric display
- Large numbers (text-4xl font-bold) + descriptive label
- Centered alignment, generous spacing
- Background: Subtle contrast from main background

### CTA Section
**Layout:** Centered, focused conversion zone
- Primary headline + supporting text
- Button group: Primary "Get Started" + Secondary "Schedule Demo"
- Contained width: max-w-3xl
- Generous padding: py-20 md:py-24

### Footer
**Layout:** Three-column grid
- Column 1: Logo + tagline + social links
- Column 2: Quick links (Product, Solutions, Resources)
- Column 3: Contact info + newsletter signup
- Bottom bar: Copyright + legal links

## Component Library

### Navigation
- Fixed header: backdrop-blur-md with border-b
- Logo left, navigation center, CTA button right
- Mobile: Hamburger menu, full-screen overlay

### Buttons
- Primary: Solid fill, medium size (px-6 py-3), rounded-md
- Secondary: Border treatment, matching padding
- Button groups: gap-4, wrapped in flex container
- Hover states: Subtle transform and opacity changes

### Cards
- Clean borders: border border-gray-200/300
- Padding: p-6 or p-8
- No shadows unless elevated state needed
- Rounded corners: rounded-lg

### Form Elements
- Inputs: Full-width, py-3 px-4, rounded-md, border treatment
- Labels: text-sm font-medium, mb-2
- Consistent spacing: space-y-6 for field groups
- Error states: Red border + helper text

### Data Display
- Tables: Striped rows, sticky headers, responsive horizontal scroll
- Badges: Small, rounded-full, px-3 py-1
- Progress indicators: Linear bars with percentage labels

## Images

**Hero Image:** Industrial training environment or competency assessment scenario - professional photography showing team collaboration or technical work. Position: Right side of hero, 40% width.

**Feature Images (2):** Platform interface screenshots showing:
1. Competency management dashboard with skills matrix
2. Certification tracking interface with calendar/timeline view

These images should have subtle drop shadows and rounded corners (rounded-xl) for polish.

## Accessibility
- Minimum contrast ratios: WCAG AA compliant
- Focus indicators: Visible outlines on all interactive elements
- Semantic HTML throughout
- ARIA labels for icon-only buttons