import { apiRequest, getUserId } from '../apiClient.js';

// Condensed instructions for level 3 (full)
const CONDENSED_INSTRUCTIONS = `## SVG Canvas Editing Guide

### Allowed SVG Attributes (ONLY these are permitted)
**Global** (all elements): id, class, style, transform, opacity, visibility, data-type, data-object-type, data-object-name

| Element | Allowed Attributes |
|---------|-------------------|
| svg | width, height, viewBox, xmlns, preserveAspectRatio |
| rect | x, y, width, height, rx, ry, fill, stroke, stroke-width, stroke-dasharray, stroke-dashoffset |
| circle | cx, cy, r, fill, stroke, stroke-width, stroke-dasharray, stroke-dashoffset |
| ellipse | cx, cy, rx, ry, fill, stroke, stroke-width, stroke-dasharray, stroke-dashoffset |
| line | x1, y1, x2, y2, stroke, stroke-width, stroke-linecap, stroke-dasharray, stroke-dashoffset, marker-start, marker-end |
| path | d, fill, stroke, stroke-width, stroke-linecap, stroke-linejoin, stroke-dasharray, stroke-dashoffset, fill-rule |
| polyline | points, fill, stroke, stroke-width, stroke-linejoin, stroke-linecap, stroke-dasharray, stroke-dashoffset |
| polygon | points, fill, stroke, stroke-width, stroke-linejoin, stroke-dasharray, stroke-dashoffset |
| text | x, y, dx, dy, text-anchor, font-size, font-family, font-weight, fill |
| g | transform |
| marker | markerWidth, markerHeight, refX, refY, orient, markerUnits, viewBox |
| image | x, y, width, height, href, xlink:href, preserveAspectRatio |

### FORBIDDEN (will cause 400 error)
- Event handlers: onclick, onload, onmouseover, etc.
- Scripts: \`<script>\` tags, javascript: URLs
- External URLs in href (use data: URIs for images)

### data-type Values
| Element | data-type |
|---------|-----------|
| rect | "box" |
| circle/ellipse | "shape" |
| line | "line" |
| path | "pencil" |
| text | "text" |
| g (wrapper) | use data-object-type="object" |

### Object Wrapper Format
\`\`\`xml
<g id="obj-ID" data-object-type="object" data-object-name="Name">
  <metadata><object-data xmlns=""><name>Name</name><position x="X" y="Y"/></object-data></metadata>
  <rect x="X-15" y="Y-15" width="30" height="30" fill="#color" data-type="box"/>
</g>
\`\`\`

### Rules
1. Unique IDs: \`element-timestamp-random\`
2. Always include data-type attribute on shape elements
3. Preserve SVG wrapper and existing elements
4. Only use attributes from the allowed list above

### Response Format
Return ONLY the complete SVG document, starting with \`<svg xmlns="..."\` and ending with \`</svg>\``;

export interface GetCanvasTemplateArgs {
	detail_level?: 0 | 1 | 2 | 3;
}

// Count elements in SVG
function countElements(svgContent: string): number {
	return (svgContent.match(/<(rect|circle|path|line|text|ellipse|polygon|polyline|g)/g) || []).length;
}

// Extract viewBox from SVG
function extractViewBox(svgContent: string): string {
	const match = svgContent.match(/viewBox="([^"]+)"/);
	return match ? match[1] : '0 0 1920 1080';
}

// Get element type breakdown
function getElementBreakdown(svgContent: string): Record<string, number> {
	const types = ['rect', 'circle', 'path', 'line', 'text', 'ellipse', 'polygon', 'polyline', 'g'];
	const breakdown: Record<string, number> = {};
	for (const type of types) {
		const regex = new RegExp(`<${type}[\\s>]`, 'g');
		const count = (svgContent.match(regex) || []).length;
		if (count > 0) breakdown[type] = count;
	}
	return breakdown;
}

// Count objects (groups with data-object-type)
function countObjects(svgContent: string): number {
	return (svgContent.match(/data-object-type="object"/g) || []).length;
}

// Tier 0: Metadata only (~50-100 tokens)
function buildMetadataResponse(data: any): string {
	const metadata = {
		project_id: data.id,
		title: data.title,
		element_count: countElements(data.svg_document),
		object_count: countObjects(data.svg_document),
		viewBox: extractViewBox(data.svg_document),
		pins_count: data.pins?.length || 0,
		last_updated: data.updated_at
	};
	return JSON.stringify(metadata, null, 2);
}

// Tier 1: Summary (~150-300 tokens)
function buildSummaryResponse(data: any): string {
	const metadata = {
		project_id: data.id,
		title: data.title,
		element_count: countElements(data.svg_document),
		object_count: countObjects(data.svg_document),
		viewBox: extractViewBox(data.svg_document),
		pins_count: data.pins?.length || 0,
		last_updated: data.updated_at,
		element_breakdown: getElementBreakdown(data.svg_document)
	};
	return `# Canvas Summary\n${JSON.stringify(metadata, null, 2)}`;
}

// Tier 2: SVG only (~300-2000 tokens) - NEW DEFAULT
function buildSVGResponse(data: any): string {
	return data.svg_document;
}

// Tier 3: Full guide + SVG (~1500-3000 tokens)
function buildFullResponse(data: any): string {
	const viewBox = extractViewBox(data.svg_document);
	return `${CONDENSED_INSTRUCTIONS}

## Current Canvas
\`\`\`xml
${data.svg_document}
\`\`\`

## Canvas Info
- Project: ${data.id}
- Title: ${data.title}
- ViewBox: ${viewBox}
- Elements: ${countElements(data.svg_document)}
- Objects: ${countObjects(data.svg_document)}
- Pins: ${data.pins?.length || 0}`;
}

export async function getCanvasTemplate(args: GetCanvasTemplateArgs) {
	const userId = getUserId();

	// Default to level 2 (SVG only) for token efficiency
	const detailLevel = args.detail_level ?? 2;

	// Get current canvas state via API
	const response = await apiRequest(`/api/projects/recent?userId=${userId}`);

	if (!response.project) {
		throw new Error('Project not found for your account');
	}

	const data = response.project;
	let responseText: string;

	switch (detailLevel) {
		case 0:
			responseText = buildMetadataResponse(data);
			break;
		case 1:
			responseText = buildSummaryResponse(data);
			break;
		case 2:
			responseText = buildSVGResponse(data);
			break;
		case 3:
			responseText = buildFullResponse(data);
			break;
		default:
			// Default to SVG only for invalid levels
			responseText = buildSVGResponse(data);
	}

	return {
		content: [
			{
				type: 'text' as const,
				text: responseText
			}
		]
	};
}
