import { apiRequest, getUserId } from '../apiClient.js';

// Condensed instructions for level 3 (full) - reduced from ~1600 to ~400 tokens
const CONDENSED_INSTRUCTIONS = `## SVG Canvas Editing Guide

### Element Reference
| Type | Key Attributes | data-type |
|------|----------------|-----------|
| rect | x, y, width, height, fill, stroke, rx | "box" |
| circle | cx, cy, r, fill, stroke | "shape" data-shape="circle" |
| line | x1, y1, x2, y2, stroke | "line" |
| path | d, stroke, fill | "pencil" |
| text | x, y, font-size, fill | "text" |
| g | transform | "group" or data-object-type="object" |

### Object Wrapper Format
\`\`\`xml
<g id="obj-ID" data-object-type="object" data-object-name="Name">
  <metadata><object-data xmlns=""><name>Name</name><position x="X" y="Y"/></object-data></metadata>
  <!-- Child elements MUST be within ±200px of position point -->
  <rect x="X-15" y="Y-15" width="30" height="30" fill="#color"/>
</g>
\`\`\`

### Rules
1. Unique IDs: \`element-timestamp-random\`
2. Always include data-type attribute
3. Preserve SVG wrapper and existing elements
4. Position metadata = center of child elements bounding box
5. No scripts, event handlers, or external URLs

### Response Format
Return ONLY the complete SVG document (no markdown), starting with \`<svg xmlns="..."\` and ending with \`</svg>\``;

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
