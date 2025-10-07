# Rapport MCP Server - Agent Integration Guide

## Overview

The Rapport MCP server provides AI agents with tools to read and modify visual canvases. This guide explains how agents can safely interact with Rapport canvases.

## Quick Start

### 1. View a Canvas

```typescript
// First, get the canvas to see what's there
const canvas = await use_mcp_tool({
  server_name: "rapport-mcp",
  tool_name: "get_svg",
  arguments: {
    project_id: "your-project-uuid"
  }
});
```

### 2. Get Editing Template (IMPORTANT!)

```typescript
// Before making changes, ALWAYS get the template first
const template = await use_mcp_tool({
  server_name: "rapport-mcp",
  tool_name: "get_canvas_template",
  arguments: {
    project_id: "your-project-uuid"
  }
});
```

The template provides:
- Current canvas state
- Complete element syntax examples
- Security guidelines
- Best practices
- Common patterns

### 3. Make Changes

```typescript
// After understanding the structure, update the canvas
const result = await use_mcp_tool({
  server_name: "rapport-mcp",
  tool_name: "update_svg",
  arguments: {
    project_id: "your-project-uuid",
    svg_document: "<svg>...</svg>" // Your modified SVG
  }
});
```

## Available Tools

### `get_svg`
Get the current canvas with metadata.

**Arguments:**
- `project_id` (string, required): The project UUID
- `include_metadata` (boolean, optional): Include canvas stats (default: true)

**Returns:**
- SVG document
- Canvas metadata (element count, viewBox, pins, etc.)

**Use when:**
- You need to see what's currently on the canvas
- You want canvas statistics
- You're checking the current state before making changes

---

### `get_canvas_template`
Get a comprehensive guide for editing the canvas.

**Arguments:**
- `project_id` (string, required): The project UUID

**Returns:**
- Current canvas state
- Complete editing guide with examples
- Security rules
- Element syntax reference
- Best practices

**Use when:**
- Before making ANY modifications (ALWAYS use this first!)
- Learning how to add specific element types
- Understanding canvas structure
- Checking what elements are supported

---

### `update_svg`
Update the canvas with new/modified SVG.

**Arguments:**
- `project_id` (string, required): The project UUID
- `svg_document` (string, required): Complete SVG document
- `skip_validation` (boolean, optional): Skip security checks (NOT RECOMMENDED)

**Returns:**
- Success confirmation
- Element statistics
- Any warnings

**Security checks performed:**
- ✅ No `<script>` tags
- ✅ No event handlers (onclick, onload, etc.)
- ✅ No `javascript:` protocols
- ✅ No iframe/object/embed tags
- ✅ No foreign objects
- ✅ Valid SVG structure
- ✅ Size limits (10MB max)
- ✅ Element count limits (10k max)

---

### `query_elements`
Find specific elements using CSS selectors.

**Arguments:**
- `project_id` (string, required): The project UUID
- `selector` (string, required): CSS selector

**Supported selectors:**
- `rect` - All rectangles
- `circle` - All circles
- `#element-id` - Specific element by ID
- `[data-type="box"]` - Elements by data-type

**Returns:**
- Array of matching elements with their attributes

**Use when:**
- Finding elements to modify
- Checking if certain elements exist
- Getting element properties before changing them

## Workflow Pattern

### Recommended Sequence

```
1. get_canvas_template → Understand the structure
2. get_svg → See current state
3. [Optional] query_elements → Find specific elements
4. update_svg → Make your changes
```

### Example: Adding a Blue Box

```typescript
// Step 1: Get template (learn the syntax)
const template = await use_mcp_tool({
  server_name: "rapport-mcp",
  tool_name: "get_canvas_template",
  arguments: { project_id: "abc-123" }
});

// Step 2: Get current canvas
const current = await use_mcp_tool({
  server_name: "rapport-mcp",
  tool_name: "get_svg",
  arguments: { project_id: "abc-123" }
});

// Step 3: Modify the SVG (add a blue box)
const svgDoc = current.content[0].text;
const parser = new DOMParser();
const doc = parser.parseFromString(svgDoc, 'image/svg+xml');

// Add new rectangle
const rect = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
rect.setAttribute('id', `box-${Date.now()}`);
rect.setAttribute('x', '400');
rect.setAttribute('y', '300');
rect.setAttribute('width', '200');
rect.setAttribute('height', '150');
rect.setAttribute('fill', '#3b82f6');
rect.setAttribute('stroke', '#1e40af');
rect.setAttribute('stroke-width', '2');
rect.setAttribute('rx', '8');
rect.setAttribute('ry', '8');
rect.setAttribute('data-type', 'box');

doc.documentElement.appendChild(rect);

// Step 4: Update canvas
const result = await use_mcp_tool({
  server_name: "rapport-mcp",
  tool_name: "update_svg",
  arguments: {
    project_id: "abc-123",
    svg_document: new XMLSerializer().serializeToString(doc)
  }
});
```

## Element Types Reference

### Rectangle (Box)
```xml
<rect id="unique-id" x="100" y="100" width="200" height="150"
      fill="#ffffff" stroke="#000000" stroke-width="2"
      rx="8" ry="8" data-type="box"/>
```

### Circle
```xml
<circle id="unique-id" cx="300" cy="200" r="50"
        fill="#ffffff" stroke="#000000" stroke-width="2"
        data-type="shape" data-shape="circle"/>
```

### Line
```xml
<line id="unique-id" x1="100" y1="100" x2="300" y2="200"
      stroke="#000000" stroke-width="2" data-type="line"/>
```

### Pencil Path (freeform drawing)
```xml
<path id="unique-id" d="M 100 100 L 150 120 L 200 100"
      stroke="#000000" stroke-width="2" fill="none"
      stroke-linecap="round" stroke-linejoin="round"
      data-type="pencil"/>
```

### Text
```xml
<text id="unique-id" x="100" y="100"
      font-size="16" font-family="Arial" fill="#000000"
      data-type="text">Your text here</text>
```

### Group
```xml
<g id="group-unique-id" data-type="group">
  <rect .../>
  <text .../>
</g>
```

## Best Practices

### ✅ DO

- **Always call `get_canvas_template` first** before making changes
- Use unique IDs for all new elements
- Include `data-type` attribute on all elements
- Preserve existing elements unless explicitly removing them
- Keep the `<svg>` wrapper and its attributes
- Use valid hex colors (`#RRGGBB`)
- Test your SVG structure before sending
- Be conservative with changes

### ❌ DON'T

- Don't add `<script>` tags (will be rejected)
- Don't add event handlers (onclick, onload, etc.)
- Don't use external references without consideration
- Don't remove the SVG wrapper
- Don't exceed 10MB file size
- Don't add more than 10,000 elements
- Don't guess - use the template!

## Security

All SVG content is validated before saving:

1. **Script Injection Prevention**
   - Script tags removed
   - Event handlers stripped
   - JavaScript protocols blocked

2. **XSS Prevention**
   - Foreign objects blocked
   - Iframe/embed tags rejected
   - External references monitored

3. **DoS Prevention**
   - File size limits (10MB)
   - Element count limits (10k)
   - Processing timeouts

4. **Integrity Checks**
   - Valid SVG structure required
   - Well-formed XML
   - Proper namespace declarations
   - No corrupted attributes

## Common Errors

### "SVG validation failed: Missing <svg> root element"
- Make sure your SVG starts with `<svg xmlns="http://www.w3.org/2000/svg"`

### "Dangerous content detected: script tags"
- Remove any `<script>` tags from your SVG

### "Invalid viewBox format"
- ViewBox should have 4 numbers: `viewBox="x y width height"`

### "Project not found"
- Check that your `project_id` is correct and the project exists

## Tips for Agents

1. **Start Small**: Make simple changes first to understand the system
2. **Use Templates**: Always reference `get_canvas_template` for syntax
3. **Preserve Context**: Keep existing elements when adding new ones
4. **Unique IDs**: Use timestamps or UUIDs in element IDs
5. **Test Locally**: If possible, validate SVG structure before sending
6. **Read Errors**: Validation errors provide specific guidance
7. **Ask Questions**: If unsure, ask the user for clarification

## Support

For issues or questions:
- Check the template: `get_canvas_template`
- Review validation errors: They're detailed and helpful
- Test with simple changes first
- Ask the user if you're unsure about visual intent

## Version

MCP Server Version: 1.0.0
Last Updated: 2025-10-07
