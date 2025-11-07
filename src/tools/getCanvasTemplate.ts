import { supabase, getUserId } from '../db.js';

export interface GetCanvasTemplateArgs {}

export async function getCanvasTemplate(args: GetCanvasTemplateArgs) {
	const userId = getUserId();

	// Get current canvas state
	const { data, error } = await supabase
		.from('projects')
		.select('id, svg_document, title, pins')
		.eq('user_id', userId)
		.single();

	if (error) {
		throw new Error(`Project not found for your account - ${error.message}`);
	}

	// Extract viewBox from current canvas
	const viewBoxMatch = data.svg_document.match(/viewBox="([^"]+)"/);
	const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 1920 1080';

	const template = `# Rapport Canvas Editing Guide

⚠️ **CRITICAL REQUIREMENT**: ALL elements (rect, circle, line, path, text) MUST be wrapped in \`<g data-object-type="object">\` containers with metadata. Elements without this wrapper will NOT be selectable or editable! See "Object Wrapper Structure" section below.

## Current Canvas
\`\`\`xml
${data.svg_document}
\`\`\`

## How to Modify the Canvas

### Canvas Structure
- The canvas is an SVG document with viewBox="${viewBox}"
- All coordinates are in SVG space (not screen pixels)
- The canvas has infinite scroll/zoom, so elements can be placed anywhere

### CRITICAL: Object Wrapper Structure

**ALL elements MUST be wrapped in an object container** for them to be interactive and editable. Use this structure:

\`\`\`xml
<g id="obj-unique-timestamp" data-object-type="object" data-object-name="Element Name">
  <metadata>
    <object-data xmlns="">
      <name>Element Name</name>
      <position x="100" y="100"/>
    </object-data>
  </metadata>
  <!-- Your actual element here -->
  <rect .../>
</g>
\`\`\`

### CRITICAL: Coordinate Alignment Rules

**The \`<position>\` metadata MUST align with the actual child element coordinates!**

This is essential to prevent "weird dragging" or stretching behavior. When users drag objects, Rapport uses the position as the transform origin. If position doesn't match the geometric center of children, objects will move incorrectly.

**How to calculate proper position:**

1. **Create all child elements first** with their desired coordinates
2. **Find the bounding box** - determine min/max X and Y across all children
3. **Calculate geometric center**:
   - \`position.x = (minX + maxX) / 2\`
   - \`position.y = (minY + maxY) / 2\`
4. **Set position metadata** to this center point

**Example calculation:**

\`\`\`
Child elements:
- rect at x=100, width=200 → X range: 100 to 300
- circle at cx=250, r=50 → X range: 200 to 300
Combined X range: 100 to 300 → Center X: (100 + 300) / 2 = 200

- rect at y=150, height=100 → Y range: 150 to 250
- circle at cy=200, r=50 → Y range: 150 to 250
Combined Y range: 150 to 250 → Center Y: (150 + 250) / 2 = 200

Therefore: <position x="200" y="200"/>
\`\`\`

**❌ BAD Example (will cause dragging issues):**

\`\`\`xml
<g data-object-type="object" data-object-name="Misaligned Box">
  <metadata>
    <position x="200" y="200"/>  <!-- Position here -->
  </metadata>
  <!-- But child is 600px away! -->
  <circle cx="800" cy="900" r="50"/>  ❌ 600-700px offset causes stretching!
</g>
\`\`\`

**✅ GOOD Example (proper alignment):**

\`\`\`xml
<g data-object-type="object" data-object-name="Aligned Box">
  <metadata>
    <position x="800" y="900"/>  <!-- Position matches child center -->
  </metadata>
  <circle cx="800" cy="900" r="50"/>  ✓ Perfect alignment!
</g>
\`\`\`

**Guidelines:**
- Keep children within ±200px of position point for medium-sized objects
- For grouped objects (multiple children), position should be at the geometric center
- Validator will warn if offset exceeds safe thresholds

### Transform Attributes (Alternative Approach)

You can use SVG transforms to position children relative to (0, 0):

**When to use transforms:**
- Use \`transform="translate(x, y)"\` on the \`<g>\` wrapper when you want children at relative coordinates
- Ensure position metadata matches the transform values
- This approach works well for reusable components

**Example with transform:**

\`\`\`xml
<g id="obj-${Date.now()}" data-object-type="object"
   data-object-name="Transformed Box"
   transform="translate(200, 200)">
  <metadata>
    <position x="200" y="200"/>  <!-- Matches transform -->
  </metadata>
  <!-- Children positioned around (0, 0) -->
  <rect x="-50" y="-50" width="100" height="100"/>
  <circle cx="0" cy="0" r="20"/>
</g>
\`\`\`

**⚠️ IMPORTANT:**
- **Don't mix transforms and absolute coordinates** - choose one approach
- **Don't nest multiple transforms** - use a single transform on the group
- **Keep it simple** - prefer absolute coordinates unless you have a specific reason for transforms

### Complex Multi-Part Objects

For objects with multiple children (like architecture diagrams, cartoon characters, etc.):

**Example: Multi-part object (layered structure):**

\`\`\`xml
<g id="obj-${Date.now()}" data-object-type="object" data-object-name="Layered Component">
  <metadata>
    <position x="300" y="200"/>  <!-- Center of entire structure -->
  </metadata>
  <!-- Background layer (centered at position) -->
  <rect x="250" y="150" width="100" height="100" fill="#f0f0f0" stroke="#ccc"/>
  <!-- Icon layer (near center) -->
  <circle cx="300" cy="200" r="30" fill="#3b82f6"/>
  <!-- Text layer (near center) -->
  <text x="300" y="270" text-anchor="middle" font-size="12">Label</text>
  <!-- All parts within ±50px of position (300, 200) -->
</g>
\`\`\`

**Best practices for complex objects:**
1. Design all parts with position in mind
2. Calculate bounding box of ALL children
3. Set position to bounding box center
4. Verify all children are within ±20% of object size from position

### Supported Elements

**Rectangles (boxes)** - MUST be wrapped in object container
\`\`\`xml
<g id="obj-${Date.now()}" data-object-type="object" data-object-name="Rectangle">
  <metadata>
    <object-data xmlns="">
      <name>Rectangle</name>
      <position x="100" y="100"/>
    </object-data>
  </metadata>
  <rect id="box-${Date.now()}" x="100" y="100" width="200" height="150"
        fill="#ffffff" stroke="#000000" stroke-width="2"
        rx="8" ry="8" data-type="box"/>
</g>
\`\`\`

**Circles** - MUST be wrapped in object container
\`\`\`xml
<g id="obj-${Date.now()}" data-object-type="object" data-object-name="Circle">
  <metadata>
    <object-data xmlns="">
      <name>Circle</name>
      <position x="300" y="200"/>
    </object-data>
  </metadata>
  <circle id="circle-${Date.now()}" cx="300" cy="200" r="50"
          fill="#ffffff" stroke="#000000" stroke-width="2"
          data-type="circle"/>
</g>
\`\`\`

**Lines** - MUST be wrapped in object container
\`\`\`xml
<g id="obj-${Date.now()}" data-object-type="object" data-object-name="Line">
  <metadata>
    <object-data xmlns="">
      <name>Line</name>
      <position x="0" y="0"/>
    </object-data>
  </metadata>
  <line id="line-${Date.now()}" x1="100" y1="100" x2="300" y2="200"
        stroke="#000000" stroke-width="2" data-type="line"/>
</g>
\`\`\`

**Pencil Paths** - MUST be wrapped in object container
\`\`\`xml
<g id="obj-${Date.now()}" data-object-type="object" data-object-name="Drawing">
  <metadata>
    <object-data xmlns="">
      <name>Drawing</name>
      <position x="0" y="0"/>
    </object-data>
  </metadata>
  <path id="pencil-${Date.now()}" d="M 100 100 L 150 120 L 200 100"
        stroke="#000000" stroke-width="2" fill="none"
        stroke-linecap="round" stroke-linejoin="round"
        data-type="pencil"/>
</g>
\`\`\`

**Text** - MUST be wrapped in object container
\`\`\`xml
<g id="obj-${Date.now()}" data-object-type="object" data-object-name="Text">
  <metadata>
    <object-data xmlns="">
      <name>Text</name>
      <position x="100" y="100"/>
    </object-data>
  </metadata>
  <text id="text-${Date.now()}" x="100" y="100"
        font-size="16" font-family="Arial" fill="#000000"
        data-type="text">Your text here</text>
</g>
\`\`\`

### Important Rules

1. **Always wrap elements in object containers**: Use \`<g data-object-type="object">\` wrapper for selectability
2. **Include metadata for all objects**: Required structure with \`<object-data>\` containing name and position
3. **Always include unique IDs**: Use format like \`obj-timestamp\` for groups, \`element-timestamp\` for inner elements
4. **Always include data-type attribute**: Helps our system recognize element types (box, circle, line, pencil, text)
5. **Always include data-object-name**: User-friendly name for the object
6. **Preserve the SVG wrapper**: Keep the \`<svg>\` tag and its attributes
7. **Use valid colors**: Hex colors (#RRGGBB) or named colors
8. **Keep stroke-width reasonable**: Between 1-20 for most elements
9. **Preserve existing elements**: Unless explicitly asked to remove them

### Security Notes
- Script tags (\`<script>\`) are NOT allowed and will be rejected
- Event handlers (onclick, onload, etc.) are NOT allowed
- External references (xlink:href to external URLs) are restricted
- Only inline styles and SVG attributes are permitted

### Example: Adding a New Box

To add a blue box at position (400, 300):

\`\`\`xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" id="canvas">
  <!-- Existing elements stay here -->
  ${data.svg_document.match(/<svg[^>]*>([\s\S]*)<\/svg>/)?.[1]?.trim() || ''}

  <!-- New selectable object -->
  <g id="obj-${Date.now()}" data-object-type="object" data-object-name="Blue Box">
    <metadata>
      <object-data xmlns="">
        <name>Blue Box</name>
        <position x="400" y="300"/>
      </object-data>
    </metadata>
    <rect id="box-${Date.now()}" x="400" y="300" width="200" height="150"
          fill="#3b82f6" stroke="#1e40af" stroke-width="2"
          rx="8" ry="8" data-type="box"/>
  </g>
</svg>
\`\`\`

### Example: Modifying an Existing Element

To change the color of an element with id="box-123":

1. Find the element: \`<rect id="box-123" ... fill="#ffffff" .../>\`
2. Change the fill: \`fill="#3b82f6"\`
3. Return the complete SVG with all elements

### Response Format

When making changes, return ONLY the complete, valid SVG document:
- Start with \`<svg xmlns="http://www.w3.org/2000/svg" ...\`
- Include ALL elements (existing + new/modified)
- End with \`</svg>\`
- No markdown code blocks, just the raw SVG

## Tips for AI Agents

- Start by understanding the current canvas state
- Plan your changes before modifying the SVG
- Test that your SVG is valid XML before sending
- Be conservative with changes - it's easier to add than to fix mistakes
- When in doubt, ask for clarification rather than guessing
- Coordinates increase right (x) and down (y)
- ViewBox format is: x y width height

## Current Canvas Info
- Project ID: ${data.id}
- Title: ${data.title}
- Pins: ${data.pins?.length || 0} navigation pins
- Element Count: ${(data.svg_document.match(/<(rect|circle|path|line|text|ellipse|polygon|polyline)/g) || []).length}
`;

	return {
		content: [
			{
				type: 'text' as const,
				text: template
			}
		]
	};
}
