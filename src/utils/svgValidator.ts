/**
 * Comprehensive SVG validation for security and integrity
 */

export interface ValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
	sanitized?: string;
}

/**
 * Validates and sanitizes SVG content
 */
export function validateSVG(svgContent: string): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	// 1. Check if it's a valid SVG structure
	if (!svgContent.includes('<svg')) {
		errors.push('Missing <svg> root element');
	}

	if (!svgContent.includes('</svg>')) {
		errors.push('Missing closing </svg> tag');
	}

	// 2. Security checks - block dangerous elements
	const dangerousPatterns = [
		{ pattern: /<script[^>]*>/gi, name: 'script tags' },
		{ pattern: /<iframe[^>]*>/gi, name: 'iframe tags' },
		{ pattern: /<object[\s>\/]/gi, name: 'object tags' }, // Match <object> or <object attr> but not <object-data>
		{ pattern: /<embed[^>]*>/gi, name: 'embed tags' },
		{ pattern: /on\w+\s*=/gi, name: 'event handlers (onclick, onload, etc.)' },
		{ pattern: /javascript:/gi, name: 'javascript: protocol' },
		{ pattern: /data:text\/html/gi, name: 'data:text/html protocol' },
		{ pattern: /<foreignObject/gi, name: 'foreignObject elements' }
	];

	for (const { pattern, name } of dangerousPatterns) {
		if (pattern.test(svgContent)) {
			errors.push(`Dangerous content detected: ${name}`);
		}
	}

	// 3. Check for external resource loading (security risk)
	const externalRefPattern = /xlink:href\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
	const externalRefs = svgContent.match(externalRefPattern);
	if (externalRefs && externalRefs.length > 0) {
		warnings.push(`External resource references detected (${externalRefs.length}). These may not load correctly.`);
	}

	// 4. Validate XML structure (basic check)
	// Include hyphens in tag names (e.g., object-data, custom-element)
	const openTags = (svgContent.match(/<([\w-]+)[^>]*>/g) || []);
	const closeTags = (svgContent.match(/<\/([\w-]+)>/g) || []);
	const selfClosingTags = (svgContent.match(/<[\w-]+[^>]*\/>/g) || []);

	// Don't count self-closing tags as needing closing tags
	const expectedCloseTags = openTags.length - selfClosingTags.length;

	if (closeTags.length < expectedCloseTags - 1) { // Allow some flexibility
		warnings.push(`Possible unclosed tags: ${expectedCloseTags} open tags but only ${closeTags.length} closing tags`);
	}

	// 5. Check for corrupted attributes (from known bugs)
	const corruptedAttrs = [
		/stroke-["']/gi,
		/fill-["']/gi,
		/width-["']/gi,
		/height-["']/gi
	];

	for (const pattern of corruptedAttrs) {
		if (pattern.test(svgContent)) {
			errors.push('Corrupted SVG attributes detected (attribute name ends with dash)');
			break;
		}
	}

	// 6. Validate xmlns
	if (!svgContent.includes('xmlns="http://www.w3.org/2000/svg"')) {
		warnings.push('Missing or incorrect xmlns attribute on <svg> tag');
	}

	// 7. Check viewBox format
	const viewBoxMatch = svgContent.match(/viewBox\s*=\s*["']([^"']+)["']/i);
	if (viewBoxMatch) {
		const viewBoxValues = viewBoxMatch[1].split(/\s+/);
		if (viewBoxValues.length !== 4) {
			errors.push('Invalid viewBox format (should have 4 values: x y width height)');
		} else {
			// Check if values are valid numbers
			const allNumbers = viewBoxValues.every(v => !isNaN(parseFloat(v)));
			if (!allNumbers) {
				errors.push('Invalid viewBox values (must be numbers)');
			}
		}
	} else {
		warnings.push('No viewBox attribute found');
	}

	// 8. Check for unwrapped elements (not inside <g data-object-type="object">)
	// This helps catch elements that won't be selectable in Rapport
	const elementTags = ['rect', 'circle', 'line', 'path', 'text', 'ellipse', 'polygon', 'polyline'];
	const unwrappedElements: string[] = [];

	for (const tag of elementTags) {
		// Find all elements of this type
		const regex = new RegExp(`<${tag}[^>]*id="([^"]*)"`, 'gi');
		let match;
		while ((match = regex.exec(svgContent)) !== null) {
			const elementId = match[1];

			// Skip if element is in <defs> or <marker> (these don't need wrapping)
			const beforeElement = svgContent.substring(0, match.index);
			if (beforeElement.lastIndexOf('<defs') > beforeElement.lastIndexOf('</defs') ||
				beforeElement.lastIndexOf('<marker') > beforeElement.lastIndexOf('</marker')) {
				continue;
			}

			// Check if this element is inside a <g data-object-type="object">
			// Look backwards from the element to find the nearest <g> tag
			const lastGTag = beforeElement.lastIndexOf('<g');

			if (lastGTag !== -1) {
				const gTagEnd = svgContent.indexOf('>', lastGTag);
				const gTagContent = svgContent.substring(lastGTag, gTagEnd + 1);

				// Check if it has data-object-type="object"
				if (!gTagContent.includes('data-object-type="object"')) {
					unwrappedElements.push(`${tag}#${elementId}`);
				}
			} else {
				unwrappedElements.push(`${tag}#${elementId}`);
			}
		}
	}

	if (unwrappedElements.length > 0) {
		warnings.push(
			`Found ${unwrappedElements.length} element(s) not wrapped in <g data-object-type="object"> containers. ` +
			`These elements will NOT be selectable or editable in Rapport. ` +
			`Wrap each element in: <g data-object-type="object" data-object-name="..."><metadata>...</metadata>...</g>. ` +
			`Unwrapped: ${unwrappedElements.slice(0, 5).join(', ')}${unwrappedElements.length > 5 ? '...' : ''}`
		);
	}

	// 9. Check coordinate alignment (position metadata vs child elements)
	// This prevents "weird dragging" behavior where objects stretch or move incorrectly
	const misalignedObjects: string[] = [];

	// Find all <g data-object-type="object"> elements
	const objectGroupRegex = /<g[^>]*id="([^"]*)"[^>]*data-object-type="object"[^>]*>([\s\S]*?)<\/g>/gi;
	let objectMatch;

	while ((objectMatch = objectGroupRegex.exec(svgContent)) !== null) {
		const objectId = objectMatch[1];
		const objectContent = objectMatch[2];

		// Extract position metadata
		const positionMatch = objectContent.match(/<position\s+x="([^"]+)"\s+y="([^"]+)"/i);
		if (!positionMatch) continue;

		const posX = parseFloat(positionMatch[1]);
		const posY = parseFloat(positionMatch[2]);

		if (isNaN(posX) || isNaN(posY)) continue;

		// Calculate bounding box of child elements
		let minX = Infinity, maxX = -Infinity;
		let minY = Infinity, maxY = -Infinity;
		let childCount = 0;

		// Extract coordinates from common SVG elements
		const coordinatePatterns = [
			// rect: x, y, width, height
			{ regex: /<rect[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*width="([^"]+)"[^>]*height="([^"]+)"/gi,
			  extract: (m: RegExpExecArray) => {
				const x = parseFloat(m[1]), y = parseFloat(m[2]);
				const w = parseFloat(m[3]), h = parseFloat(m[4]);
				return [{ x, y }, { x: x + w, y: y + h }];
			  }
			},
			// circle: cx, cy, r
			{ regex: /<circle[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"[^>]*r="([^"]+)"/gi,
			  extract: (m: RegExpExecArray) => {
				const cx = parseFloat(m[1]), cy = parseFloat(m[2]), r = parseFloat(m[3]);
				return [{ x: cx - r, y: cy - r }, { x: cx + r, y: cy + r }];
			  }
			},
			// ellipse: cx, cy, rx, ry
			{ regex: /<ellipse[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"[^>]*rx="([^"]+)"[^>]*ry="([^"]+)"/gi,
			  extract: (m: RegExpExecArray) => {
				const cx = parseFloat(m[1]), cy = parseFloat(m[2]);
				const rx = parseFloat(m[3]), ry = parseFloat(m[4]);
				return [{ x: cx - rx, y: cy - ry }, { x: cx + rx, y: cy + ry }];
			  }
			},
			// line: x1, y1, x2, y2
			{ regex: /<line[^>]*x1="([^"]+)"[^>]*y1="([^"]+)"[^>]*x2="([^"]+)"[^>]*y2="([^"]+)"/gi,
			  extract: (m: RegExpExecArray) => [
				{ x: parseFloat(m[1]), y: parseFloat(m[2]) },
				{ x: parseFloat(m[3]), y: parseFloat(m[4]) }
			  ]
			},
			// text: x, y
			{ regex: /<text[^>]*x="([^"]+)"[^>]*y="([^"]+)"/gi,
			  extract: (m: RegExpExecArray) => [{ x: parseFloat(m[1]), y: parseFloat(m[2]) }]
			}
		];

		for (const pattern of coordinatePatterns) {
			let match;
			while ((match = pattern.regex.exec(objectContent)) !== null) {
				const points = pattern.extract(match);
				for (const point of points) {
					if (!isNaN(point.x) && !isNaN(point.y)) {
						minX = Math.min(minX, point.x);
						maxX = Math.max(maxX, point.x);
						minY = Math.min(minY, point.y);
						maxY = Math.max(maxY, point.y);
						childCount++;
					}
				}
			}
		}

		// Skip if no children found
		if (childCount === 0 || !isFinite(minX)) continue;

		// Calculate geometric center of bounding box
		const centerX = (minX + maxX) / 2;
		const centerY = (minY + maxY) / 2;

		// Calculate offset from position metadata
		const offsetX = Math.abs(posX - centerX);
		const offsetY = Math.abs(posY - centerY);
		const maxOffset = Math.max(offsetX, offsetY);

		// Calculate bounding box dimensions for threshold adjustment
		const bboxWidth = maxX - minX;
		const bboxHeight = maxY - minY;
		const bboxSize = Math.max(bboxWidth, bboxHeight);

		// Dynamic threshold: 20% of object size, min 50px, max 300px
		const threshold = Math.max(50, Math.min(300, bboxSize * 0.2));

		if (maxOffset > threshold) {
			misalignedObjects.push(
				`${objectId} (offset: ${Math.round(maxOffset)}px, ` +
				`position: [${Math.round(posX)}, ${Math.round(posY)}], ` +
				`center: [${Math.round(centerX)}, ${Math.round(centerY)}])`
			);

			// Critical error if offset is extreme (>1000px)
			if (maxOffset > 1000) {
				errors.push(
					`CRITICAL: Object "${objectId}" has extreme coordinate misalignment (${Math.round(maxOffset)}px offset). ` +
					`This WILL cause severe dragging issues. Position metadata is at (${Math.round(posX)}, ${Math.round(posY)}) ` +
					`but child elements are centered around (${Math.round(centerX)}, ${Math.round(centerY)}). ` +
					`Update position to match child center.`
				);
			}
		}
	}

	if (misalignedObjects.length > 0) {
		warnings.push(
			`Found ${misalignedObjects.length} object(s) with position metadata NOT aligned to child element centers. ` +
			`This may cause "weird dragging" or stretching behavior. ` +
			`The <position> should be at the geometric center of all children. ` +
			`Misaligned: ${misalignedObjects.slice(0, 3).join('; ')}${misalignedObjects.length > 3 ? '...' : ''}`
		);
	}

	// 10. Sanitize SVG (remove dangerous content)
	let sanitized = svgContent;

	// Remove script tags
	sanitized = sanitized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

	// Remove event handlers
	sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');

	// Remove javascript: protocols
	sanitized = sanitized.replace(/javascript:[^"'\s]*/gi, 'about:blank');

	// 11. Size validation
	const sizeInBytes = new Blob([svgContent]).size;
	const maxSize = 10 * 1024 * 1024; // 10MB
	if (sizeInBytes > maxSize) {
		errors.push(`SVG too large: ${(sizeInBytes / 1024 / 1024).toFixed(2)}MB (max: ${maxSize / 1024 / 1024}MB)`);
	}

	// 12. Element count validation (prevent DoS)
	const elementCount = (svgContent.match(/<\w+[^>]*>/g) || []).length;
	const maxElements = 10000;
	if (elementCount > maxElements) {
		errors.push(`Too many elements: ${elementCount} (max: ${maxElements})`);
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
		sanitized: errors.length === 0 ? sanitized : undefined
	};
}

/**
 * Quick validation for basic SVG structure
 */
export function isValidSVGStructure(svgContent: string): boolean {
	return (
		svgContent.includes('<svg') &&
		svgContent.includes('</svg>') &&
		!/<script/i.test(svgContent) &&
		!/on\w+\s*=/i.test(svgContent)
	);
}

/**
 * Extract basic SVG statistics
 */
export function getSVGStats(svgContent: string) {
	const elementCounts = {
		rect: (svgContent.match(/<rect/gi) || []).length,
		circle: (svgContent.match(/<circle/gi) || []).length,
		path: (svgContent.match(/<path/gi) || []).length,
		line: (svgContent.match(/<line/gi) || []).length,
		text: (svgContent.match(/<text/gi) || []).length,
		g: (svgContent.match(/<g\s/gi) || []).length,
		ellipse: (svgContent.match(/<ellipse/gi) || []).length,
		polygon: (svgContent.match(/<polygon/gi) || []).length,
		polyline: (svgContent.match(/<polyline/gi) || []).length
	};

	const totalElements = Object.values(elementCounts).reduce((sum, count) => sum + count, 0);
	const sizeKB = (new Blob([svgContent]).size / 1024).toFixed(2);

	return {
		totalElements,
		elementCounts,
		sizeKB
	};
}
