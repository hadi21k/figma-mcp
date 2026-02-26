---
name: figma-design-system
description:
  Comprehensive Figma design skill for building professional UI through the
  Figma MCP server. Use this skill whenever Claude is designing interfaces,
  building components, creating layouts, establishing design systems, working
  with Figma variables/styles, or doing any visual design work via the Figma
  MCP tools. Covers design workflow, auto layout patterns, component
  architecture, typography systems, color systems, spacing scales, and the
  correct sequencing of MCP tool calls. Also use when the user mentions
  "design", "Figma", "UI", "layout", "component", "mockup", "wireframe",
  "prototype", "design system", "style guide", or any visual design task.
---

# Figma Design System Skill

Build professional, well-structured UI designs through the Figma MCP server. This skill ensures Claude approaches Figma design work systematically — thinking like a designer, not just an API caller.

## Core Philosophy

The Figma MCP gives you 67 tools to manipulate a Figma file. But tools without design thinking produce messy files. This skill teaches you how to think about structure, then use the tools to execute that structure.

**The golden rule**: Plan the layout tree in your head first. Then build from the inside out.

---

## 1. Design Workflow

Every design task follows this sequence. Do not skip steps.

### Step 1: Understand Context

- Use `get_document_info` to see existing pages, frames, and structure
- Use `get_local_components` to know what components already exist
- Use `get_local_styles` to see established color/text/effect styles
- Use `get_variables` to check for existing variable collections
- Ask the user about target screen size, brand, and content if not specified

### Step 2: Set Up Foundation

- Navigate to the correct page with `set_current_page`, or create one with `create_page`
- If no design system exists yet, establish styles and variables first (see Section 4)
- Determine the frame dimensions (common: 1440×900 desktop, 390×844 mobile, 768×1024 tablet)

### Step 3: Plan the Layout Tree

Before creating anything, map out the hierarchy. Example for a landing page hero:

```
hero-section (frame, 1440×900, vertical auto layout)
├── nav-bar (frame, horizontal auto layout, fill width)
│   ├── logo (frame or image)
│   ├── nav-links (frame, horizontal auto layout, gap 32)
│   │   ├── link-1 (text)
│   │   ├── link-2 (text)
│   │   └── link-3 (text)
│   └── cta-button (frame, horizontal auto layout, padding 12/24)
│       └── button-label (text)
├── hero-content (frame, vertical auto layout, centered, gap 24)
│   ├── headline (text, H1)
│   ├── subtitle (text, body large)
│   └── action-row (frame, horizontal auto layout, gap 16)
│       ├── primary-button (frame)
│       └── secondary-button (frame)
└── hero-image (rectangle or image fill)
```

### Step 4: Build Inside-Out

Create the innermost elements first, then compose them into containers:

1. Create text nodes and shapes
2. Create small auto layout frames around them (buttons, icon+label pairs)
3. Compose those into section-level frames
4. Stack sections into the top-level page frame

### Step 5: Apply Design Tokens

After structure is in place:

- Apply paint styles or bind color variables to fills
- Apply text styles to text nodes
- Apply effect styles (shadows, blurs) as needed

### Step 6: Review and Clean Up

- Verify all layers are named descriptively
- Check that auto layout is applied to all container frames
- Use `zoom_to_node` on the top-level frame to review
- Export a preview with `export_node` if the user wants to see the result

---

## 2. Auto Layout Patterns

Auto layout is the backbone of Figma design. Every container frame should use it.

### Setting Up Auto Layout

After creating a frame with `create_frame`, immediately call `set_auto_layout`:

```
set_auto_layout({
  nodeId: "<frame-id>",
  direction: "VERTICAL",      // or "HORIZONTAL"
  spacing: 16,                // gap between children
  paddingTop: 24,
  paddingRight: 24,
  paddingBottom: 24,
  paddingLeft: 24,
  primaryAxisAlignment: "CENTER",   // main axis: MIN, CENTER, MAX, SPACE_BETWEEN
  counterAxisAlignment: "CENTER",   // cross axis: MIN, CENTER, MAX
  layoutWrap: "NO_WRAP"            // or "WRAP" for flex-wrap behavior
})
```

### Child Sizing with `set_node_layout_properties`

After placing children inside an auto layout frame, set their sizing:

- **Fill**: Child stretches to fill available space on that axis → `layoutSizingHorizontal: "FILL"` or `layoutSizingVertical: "FILL"`
- **Hug**: Child wraps its own content → `"HUG"`
- **Fixed**: Child stays at its set dimension → `"FIXED"`

Common patterns:

- **Full-width child in a vertical stack**: `layoutSizingHorizontal: "FILL"`
- **Button that adapts to text**: Both axes set to `"HUG"`, with padding on the parent
- **Section that fills the page width**: `layoutSizingHorizontal: "FILL"`, `layoutSizingVertical: "HUG"`

### Nesting Pattern

To create two-dimensional layouts, alternate between vertical and horizontal auto layout:

```
page-wrapper (VERTICAL auto layout)
├── section-1 (HORIZONTAL auto layout) — fills width
│   ├── left-column (VERTICAL) — fills height, fixed or fill width
│   └── right-column (VERTICAL) — fills height, fill width
├── section-2 (VERTICAL auto layout) — fills width
│   ├── heading (text, hug)
│   └── card-grid (HORIZONTAL auto layout, WRAP)
│       ├── card-1 (VERTICAL, fixed width)
│       ├── card-2 (VERTICAL, fixed width)
│       └── card-3 (VERTICAL, fixed width)
```

### Common Auto Layout Recipes

**Centered content with max width**:

- Outer frame: fill width, horizontal auto layout, center aligned
- Inner frame: fixed width (e.g., 1200px), vertical auto layout

**Spacer (push elements apart)**:

- Use `primaryAxisAlignment: "SPACE_BETWEEN"` on the parent
- This pushes the first child to the start and last child to the end (like a nav bar with logo left, buttons right)

**Equal-width columns**:

- Parent: horizontal auto layout
- Children: each set to `layoutSizingHorizontal: "FILL"`

---

## 3. Component Architecture

### When to Create Components

Create a component when:

- An element repeats 2+ times in the design
- An element has distinct states (default, hover, active, disabled)
- You're building a design system

### Building a Component

1. Create the element with its full auto layout structure
2. Name it with a clear hierarchy: `button/primary/default`
3. Use `create_component` to convert the frame to a component
4. To create instances elsewhere, use `create_component_instance`

### Variant Strategy

For components with multiple states or types:

1. Create each variant as a separate component with a descriptive name:
   - `button/primary/default`
   - `button/primary/hover`
   - `button/secondary/default`
   - `button/secondary/hover`
2. Use `combine_as_variants` to merge them into a variant set
3. The naming convention with slashes creates automatic variant properties

### Component Naming Convention

Use forward slashes to create hierarchy in the assets panel:

```
icon/arrow/right
icon/arrow/left
button/primary
button/secondary
button/ghost
card/product
card/profile
input/text/default
input/text/focused
input/text/error
```

---

## 4. Design System Setup

When establishing a new design system, follow this order:

### 4a. Color System

**Using Variables (recommended for theming)**:

```
1. create_variable_collection({ name: "Colors", modes: ["Light", "Dark"] })
2. create_variable({ collectionName: "Colors", name: "bg/primary", type: "COLOR",
     values: { "Light": "#FFFFFF", "Dark": "#0F172A" } })
3. create_variable({ collectionName: "Colors", name: "text/primary", type: "COLOR",
     values: { "Light": "#0F172A", "Dark": "#F8FAFC" } })
4. bind_variable({ nodeId: "...", property: "fills", variableName: "bg/primary" })
```

**Using Paint Styles (simpler, no theming)**:

```
1. create_paint_style({ name: "Primary/500", color: { r: 0.31, g: 0.27, b: 0.9, a: 1 } })
2. apply_style({ nodeId: "...", styleId: "<style-id>" })
```

Recommended color token structure:

```
bg/primary, bg/secondary, bg/tertiary, bg/surface, bg/inverse
text/primary, text/secondary, text/disabled, text/inverse, text/link
border/default, border/strong, border/subtle
accent/primary, accent/secondary
semantic/success, semantic/warning, semantic/error, semantic/info
```

### 4b. Typography System

Create text styles for each level:

```
create_text_style({
  name: "Heading/H1",
  fontFamily: "Inter",
  fontWeight: "Bold",
  fontSize: 36,
  lineHeight: 44,
  letterSpacing: -0.5
})
```

Recommended text style structure:

```
Display/Large (48-72px, bold)
Display/Small (36-48px, bold)
Heading/H1 (32-36px, bold)
Heading/H2 (24-28px, semibold)
Heading/H3 (20px, semibold)
Heading/H4 (16-18px, semibold)
Body/Large (18px, regular)
Body/Default (16px, regular)
Body/Small (14px, regular)
Caption (12px, regular)
Label (12-14px, medium)
```

### 4c. Effect System

Create effect styles for elevation levels:

```
create_effect_style({
  name: "Shadow/Small",
  effects: [{
    type: "DROP_SHADOW",
    color: { r: 0, g: 0, b: 0, a: 0.08 },
    offset: { x: 0, y: 1 },
    radius: 3,
    spread: 0
  }]
})
```

Recommended shadow tokens:

```
Shadow/Small   — y:1, blur:3   — subtle cards, buttons
Shadow/Medium  — y:4, blur:8   — dropdowns, popovers
Shadow/Large   — y:8, blur:24  — modals, dialogs
Shadow/XLarge  — y:16, blur:48 — floating panels
```

### 4d. Spacing Variables

For consistent spacing across the file:

```
create_variable_collection({ name: "Spacing", modes: ["Default"] })
create_variable({ collectionName: "Spacing", name: "space/4", type: "FLOAT", values: { "Default": 4 } })
create_variable({ collectionName: "Spacing", name: "space/8", type: "FLOAT", values: { "Default": 8 } })
// Continue: 12, 16, 20, 24, 32, 40, 48, 64, 80, 96
```

---

## 5. MCP Tool Sequencing

### Efficient Tool Usage

The MCP communicates over WebSocket with a 30-second default timeout. Be efficient:

- **Batch when possible**: `batch_create` for creating multiple similar nodes, `batch_update` for applying properties to multiple nodes
- **Read once, write many**: Get document info at the start, then work from that knowledge
- **Minimize round trips**: Plan your creation order to avoid having to go back and reparent or reorder nodes

### Critical Tool Sequences

**Creating a styled text node**:

```
1. create_text({ text, fontSize, fontFamily, fontWeight, ... })
   → returns nodeId
2. set_fill({ nodeId, fills: [{ type: "SOLID", color }] })
   — or apply_style if a text style exists
3. set_node_layout_properties({ nodeId, layoutSizingHorizontal: "FILL" })
   — if it should fill its parent
```

**Creating a button component**:

```
1. create_frame({ name: "button/primary", width: 120, height: 44 })
2. set_auto_layout({ nodeId, direction: "HORIZONTAL", spacing: 8,
     paddingTop: 12, paddingRight: 24, paddingBottom: 12, paddingLeft: 24,
     primaryAxisAlignment: "CENTER", counterAxisAlignment: "CENTER" })
3. set_fill({ nodeId, fills: [{ type: "SOLID", color: primaryColor }] })
4. set_corner_radius({ nodeId, topLeft: 8, topRight: 8, bottomLeft: 8, bottomRight: 8 })
5. create_text({ parentId: nodeId, text: "Button", fontFamily: "Inter",
     fontWeight: "Semibold", fontSize: 14, fills: [{ type: "SOLID", color: white }] })
6. create_component({ nodeId })
```

**Creating a card with image**:

```
1. create_frame({ name: "card/product", width: 320, height: 400 })
2. set_auto_layout({ nodeId, direction: "VERTICAL", spacing: 0 })
3. set_corner_radius({ nodeId, all: 12 })
4. set_fill({ nodeId, fills: [{ type: "SOLID", color: white }] })
5. add_shadow({ nodeId, ... })
6. create_rectangle({ parentId: nodeId, name: "card-image", width: 320, height: 200 })
   → set child to fill horizontal, fixed height
   → set_image_from_url if image available
7. create_frame({ parentId: nodeId, name: "card-content" })
   → set_auto_layout vertical, padding 16, gap 8
   → set child to fill horizontal, hug vertical
8. create_text nodes inside card-content for title, description, etc.
```

---

## 6. Common Design Patterns

### Navigation Bar

- Frame: horizontal auto layout, `SPACE_BETWEEN` primary axis
- Left group: logo + nav links (horizontal auto layout, gap 32)
- Right group: actions/buttons (horizontal auto layout, gap 16)
- Height: 56-72px
- Full width: `layoutSizingHorizontal: "FILL"` on the nav frame

### Hero Section

- Frame: vertical auto layout, center aligned, generous padding (80-120px vertical)
- Content width constrained (max ~680px for text readability)
- Heading + subtitle + CTA button group
- Optional background image or gradient

### Card Grid

- Container: horizontal auto layout with `layoutWrap: "WRAP"`, gap 24
- Cards: fixed width (280-360px), vertical auto layout, hug height
- Each card: image area + content area + optional footer

### Form Layout

- Frame: vertical auto layout, gap 20-24
- Each field: vertical auto layout (label + input), gap 6-8
- Input: frame with border stroke, horizontal auto layout, padding 12/16
- Submit area: horizontal auto layout, end-aligned or full-width button

### Modal/Dialog

- Overlay: full-screen frame with semi-transparent fill
- Dialog: centered frame, vertical auto layout, padding 24-32, corner radius 12-16
- Sections: header (with close button), body, footer (action buttons)

---

## 7. Quality Checklist

Before considering a design task complete, verify:

- [ ] All frames use auto layout (unless explicitly justified)
- [ ] All layers have descriptive names (no "Frame 1", "Rectangle 5")
- [ ] Colors come from styles or variables, not raw hex values
- [ ] Typography uses text styles, not one-off font settings
- [ ] Spacing follows the 4/8px grid scale
- [ ] Components are created for any repeating elements
- [ ] The layer hierarchy is clean and logically nested
- [ ] Text contrast meets WCAG AA (4.5:1 for body, 3:1 for large text)
- [ ] Interactive elements are at least 44×44px touch target size
- [ ] The design has been exported or zoomed to for visual review
