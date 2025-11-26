import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

export interface ValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
	sanitized?: string;
}

const ALLOWED_TAGS = [
	'svg', 'g', 'rect', 'circle', 'path', 'line', 'text', 'ellipse', 'polygon', 'polyline',
	'defs', 'marker', 'metadata', 'position', 'size', 'connections', 'style'
];

const ALLOWED_ATTRS = [
	'id', 'data-type', 'data-object-type', 'data-object-name', 'data-connection-type',
	'x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'd', 'x1', 'y1', 'x2', 'y2',
	'fill', 'stroke', 'stroke-width', 'transform', 'viewbox', 'preserveaspectratio',
	'marker-end', 'marker-start', 'marker-mid', 'orient', 'refx', 'refy', 'markerwidth', 'markerheight',
	'points', 'font-family', 'font-size', 'text-anchor', 'dominant-baseline', 'rx', 'ry', 'xmlns'
];

export function validateSVG(svgContent: string): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];
	
	const window = new JSDOM('').window;
	const purify = DOMPurify(window);

	const sanitized = purify.sanitize(svgContent, {
		USE_PROFILES: { svg: true, svgFilters: true },
		ALLOWED_TAGS,
		ALLOWED_ATTR: ALLOWED_ATTRS,
		FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'foreignobject'],
		FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout', 'onfocus', 'onblur']
	});

	if (!sanitized) {
		errors.push('SVG content is empty after sanitization.');
		return { valid: false, errors, warnings };
	}

	const doc = new JSDOM(sanitized).window.document;
	const svgElement = doc.querySelector('svg');

	if (!svgElement) {
		errors.push('Missing <svg> root element');
	} else {
		if (!svgElement.hasAttribute('xmlns') || svgElement.getAttribute('xmlns') !== 'http://www.w3.org/2000/svg') {
			warnings.push('Missing or incorrect xmlns attribute on <svg> tag. It will be added automatically.');
			svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
		}

		if (!svgElement.hasAttribute('viewBox')) {
			warnings.push('No viewBox attribute found');
		}
	}

	const sizeInBytes = new Blob([sanitized]).size;
	const maxSize = 10 * 1024 * 1024; // 10MB
	if (sizeInBytes > maxSize) {
		errors.push(`SVG too large: ${(sizeInBytes / 1024 / 1024).toFixed(2)}MB (max: ${maxSize / 1024 / 1024}MB)`);
	}

	const elementCount = doc.querySelectorAll('*').length;
	const maxElements = 10000;
	if (elementCount > maxElements) {
		errors.push(`Too many elements: ${elementCount} (max: ${maxElements})`);
	}
	
	return {
		valid: errors.length === 0,
		errors,
		warnings,
		sanitized: errors.length === 0 ? svgElement?.outerHTML : undefined
	};
}

export function isValidSVGStructure(svgContent: string): boolean {
	const result = validateSVG(svgContent);
	return result.valid;
}

export function getSVGStats(svgContent: string) {
	const doc = new JSDOM(svgContent).window.document;
	const elementCounts = {
		rect: doc.querySelectorAll('rect').length,
		circle: doc.querySelectorAll('circle').length,
		path: doc.querySelectorAll('path').length,
		line: doc.querySelectorAll('line').length,
		text: doc.querySelectorAll('text').length,
		g: doc.querySelectorAll('g').length,
		ellipse: doc.querySelectorAll('ellipse').length,
		polygon: doc.querySelectorAll('polygon').length,
		polyline: doc.querySelectorAll('polyline').length
	};

	const totalElements = Object.values(elementCounts).reduce((sum, count) => sum + count, 0);
	const sizeKB = (new Blob([svgContent]).size / 1024).toFixed(2);

	return {
		totalElements,
		elementCounts,
		sizeKB
	};
}