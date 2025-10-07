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

## Current Canvas
\`\`\`xml
${data.svg_document}
\`\`\`

## How to Modify the Canvas

### Canvas Structure
- The canvas is an SVG document with viewBox="${viewBox}"
- All coordinates are in SVG space (not screen pixels)
- The canvas has infinite scroll/zoom, so elements can be placed anywhere

### Supported Elements

**Rectangles (boxes)**
\`\`\`xml
<rect id="unique-id" x="100" y="100" width="200" height="150"
      fill="#ffffff" stroke="#000000" stroke-width="2"
      rx="8" ry="8" data-type="box"/>
\`\`\`

**Circles**
\`\`\`xml
<circle id="unique-id" cx="300" cy="200" r="50"
        fill="#ffffff" stroke="#000000" stroke-width="2"
        data-type="shape" data-shape="circle"/>
\`\`\`

**Lines**
\`\`\`xml
<line id="unique-id" x1="100" y1="100" x2="300" y2="200"
      stroke="#000000" stroke-width="2" data-type="line"/>
\`\`\`

**Pencil Paths**
\`\`\`xml
<path id="unique-id" d="M 100 100 L 150 120 L 200 100"
      stroke="#000000" stroke-width="2" fill="none"
      stroke-linecap="round" stroke-linejoin="round"
      data-type="pencil"/>
\`\`\`

**Text**
\`\`\`xml
<text id="unique-id" x="100" y="100"
      font-size="16" font-family="Arial" fill="#000000"
      data-type="text">Your text here</text>
\`\`\`

**Groups (for organizing)**
\`\`\`xml
<g id="group-unique-id" data-type="group">
  <!-- Child elements here -->
  <rect .../>
  <text .../>
</g>
\`\`\`

### Important Rules

1. **Always include unique IDs**: Use format like \`element-timestamp-random\`
2. **Always include data-type attribute**: Helps our system recognize element types
3. **Preserve the SVG wrapper**: Keep the \`<svg>\` tag and its attributes
4. **Use valid colors**: Hex colors (#RRGGBB) or named colors
5. **Keep stroke-width reasonable**: Between 1-20 for most elements
6. **Preserve existing elements**: Unless explicitly asked to remove them

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

  <!-- New element -->
  <rect id="box-${Date.now()}-new" x="400" y="300" width="200" height="150"
        fill="#3b82f6" stroke="#1e40af" stroke-width="2"
        rx="8" ry="8" data-type="box"/>
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
