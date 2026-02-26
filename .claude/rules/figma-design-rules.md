# Figma MCP Design Rules

These rules apply whenever Claude is working with Figma through the MCP server. They are non-negotiable guardrails that prevent common mistakes and ensure professional-quality output.

---

## Structure First

- ALWAYS use `get_document_info` before creating anything in a new session. Understand what exists before adding to it.
- ALWAYS use `get_local_components` and `get_local_styles` before creating new components or styles. Never duplicate what already exists.
- ALWAYS plan the full layout hierarchy before making the first `create_frame` call. Write the tree structure in your thinking, then execute.
- NEVER create elements at the document root without a parent frame. Everything belongs inside a named, auto layout frame.

## Auto Layout

- ALWAYS apply `set_auto_layout` to every container frame immediately after creating it. Auto layout is the default, not the exception.
- ALWAYS use the `spacing` (gap) property for distance between siblings. Never insert empty spacer rectangles or frames.
- ALWAYS use `padding` properties on the parent frame for internal spacing. Never offset children manually to simulate padding.
- ALWAYS set `layoutSizingHorizontal` and `layoutSizingVertical` on children inside auto layout frames. Don't leave them at default when the design calls for fill or hug behavior.
- PREFER `"HUG"` for components and `"FILL"` for page-level sections. Use `"FIXED"` only when a specific pixel dimension is required.

## Naming

- ALWAYS name every frame, component, and meaningful layer with a descriptive name that communicates its purpose. Examples: `hero-section`, `nav-bar`, `card/product`, `button/primary`.
- NEVER leave auto-generated names like "Frame 1", "Rectangle 4", "Group 7". Rename immediately upon creation.
- USE forward-slash convention for component hierarchy: `category/variant/state` (e.g., `button/primary/default`, `icon/chevron/right`).
- NAME text nodes by their role: `heading`, `subtitle`, `body-text`, `button-label`, `input-label` — not by their content.

## Colors and Styles

- ALWAYS create paint styles or color variables before using a color more than once. Use `create_paint_style` or `create_variable` (with a Colors collection), then apply with `apply_style` or `bind_variable`.
- NEVER hardcode the same hex color on multiple nodes without a shared style or variable. This makes future changes painful and error-prone.
- ALWAYS ensure text color has at minimum 4.5:1 contrast ratio against its background for body text, and 3:1 for large text (18px+ bold or 24px+ regular). This is a WCAG AA requirement.
- USE semantic naming for colors: `bg/primary`, `text/secondary`, `border/default`, `accent/primary` — not `blue-500` or `#4F46E5`.

## Typography

- ALWAYS create text styles for each typographic level in the design. Use `create_text_style` to define them, then `apply_style` to use them.
- ALWAYS load fonts before creating text. The MCP `create_text` tool handles font loading, but verify the font family is available with `list_available_fonts` if there are issues.
- STICK to a typographic scale. Body text: 14-16px. Headings step up in clear increments: 18, 20, 24, 28, 32, 36, 48. Don't use arbitrary sizes like 15px or 27px.
- LIMIT to 2-3 font families maximum per design. One for headings, one for body, optionally one for code or special use.

## Spacing

- USE a consistent spacing scale based on 4px increments: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96.
- NEVER use arbitrary spacing values. If you need 13px of padding, use 12 or 16 instead.
- APPLY spacing through auto layout properties (padding and gap) — not by absolute positioning or invisible spacer elements.

## Components

- CREATE components for any UI element that appears 2+ times. Use `create_component`.
- ALWAYS build components with auto layout so they adapt to content changes.
- NEVER modify a component instance's internal structure directly when the change should apply to all instances. Modify the main component instead.
- USE `create_component_instance` to place instances. Never clone a component with `clone_node` when you want a linked instance.
- COMBINE related variants with `combine_as_variants` to create proper variant sets.

## Efficiency

- USE `batch_create` when creating 3 or more similar elements. This reduces MCP round-trips and is faster.
- USE `batch_update` when applying the same property change to multiple nodes.
- MINIMIZE tool calls by planning the creation order upfront. Creating elements inside a parent frame (using `parentId`) is more efficient than creating them separately and moving them later.
- SET multiple properties in a single `update_node` call when possible, rather than making separate calls for position, size, and fills.

## Safety and Cleanup

- NEVER delete nodes without first checking what they contain. Use `get_node` to inspect before calling `delete_node`.
- ALWAYS use `get_selection` or `find_nodes` to verify the state of the canvas before making destructive changes.
- USE `lock_node` on finalized elements or design system components to protect them from accidental edits during layout work.
- PREFER `clone_node` over recreating complex structures from scratch when you need a similar element.

## Images

- ONLY use `set_image_from_url` with publicly accessible URLs. Do not assume a URL is accessible — the MCP will fail silently on protected resources.
- ALWAYS create a properly sized rectangle or frame first, then apply the image fill to it. Don't try to create and fill in one step.
- USE placeholder rectangles with a light gray fill (`#E5E7EB`) and a label when final images aren't available yet.

## Design System Hygiene

- WHEN creating a design system, establish tokens (variables, styles) BEFORE building components. Components reference tokens, not raw values.
- ORGANIZE variables into collections by purpose: `Colors`, `Spacing`, `Border Radius`, `Typography` (if supported).
- NAME variables with a clear hierarchy using forward slashes: `bg/primary`, `space/16`, `radius/md`.
- DOCUMENT design decisions by naming things clearly. The Figma file itself should be self-documenting through its layer names, component names, and style names.
