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
		{ pattern: /<object[^>]*>/gi, name: 'object tags' },
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
	const openTags = (svgContent.match(/<(\w+)[^>]*>/g) || []);
	const closeTags = (svgContent.match(/<\/(\w+)>/g) || []);
	const selfClosingTags = (svgContent.match(/<\w+[^>]*\/>/g) || []);

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

	// 8. Sanitize SVG (remove dangerous content)
	let sanitized = svgContent;

	// Remove script tags
	sanitized = sanitized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

	// Remove event handlers
	sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');

	// Remove javascript: protocols
	sanitized = sanitized.replace(/javascript:[^"'\s]*/gi, 'about:blank');

	// 9. Size validation
	const sizeInBytes = new Blob([svgContent]).size;
	const maxSize = 10 * 1024 * 1024; // 10MB
	if (sizeInBytes > maxSize) {
		errors.push(`SVG too large: ${(sizeInBytes / 1024 / 1024).toFixed(2)}MB (max: ${maxSize / 1024 / 1024}MB)`);
	}

	// 10. Element count validation (prevent DoS)
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
