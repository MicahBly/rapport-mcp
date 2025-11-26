import { apiRequest, getUserId } from '../apiClient.js';
import { JSDOM } from 'jsdom';

export interface QueryElementsArgs {
	selector: string;
}

// XXE protection: reject documents with DTD declarations or entity definitions
function validateXMLSafety(content: string): void {
	const dangerousPatterns = [
		/<!DOCTYPE/i,
		/<!ENTITY/i,
		/SYSTEM\s+["']/i,
		/PUBLIC\s+["']/i,
	];

	for (const pattern of dangerousPatterns) {
		if (pattern.test(content)) {
			throw new Error('SVG document contains potentially dangerous XML declarations');
		}
	}
}

export async function queryElements(args: QueryElementsArgs) {
	const userId = getUserId();

	// Get canvas via API
	const response = await apiRequest(`/api/projects/recent?userId=${userId}`);

	if (!response.project) {
		throw new Error('Project not found for your account');
	}

	const data = response.project;

	// XXE protection: validate before parsing
	validateXMLSafety(data.svg_document);

	// Use JSDOM for safer XML parsing (no XXE by default)
	const dom = new JSDOM(data.svg_document, { contentType: 'image/svg+xml' });
	const doc = dom.window.document;

	// Simple querySelector implementation - just find by tag or ID
	let elements: Element[] = [];

	if (args.selector.startsWith('#')) {
		const id = args.selector.substring(1);
		const el = doc.getElementById(id);
		if (el) elements = [el];
	} else if (args.selector.startsWith('[data-type=')) {
		const match = args.selector.match(/\[data-type="?([^"\]]+)"?\]/);
		if (match) {
			const type = match[1];
			const all = doc.getElementsByTagName('*');
			for (let i = 0; i < all.length; i++) {
				const el = all[i];
				if (el.getAttribute && el.getAttribute('data-type') === type) {
					elements.push(el);
				}
			}
		}
	} else {
		const all = doc.getElementsByTagName(args.selector);
		elements = Array.from({ length: all.length }, (_, i) => all[i]);
	}

	const results = elements.map((el) => {
		const attrs: Record<string, string> = {};
		if (el.attributes) {
			for (let i = 0; i < el.attributes.length; i++) {
				const attr = el.attributes[i];
				attrs[attr.name] = attr.value;
			}
		}

		return {
			id: el.getAttribute ? el.getAttribute('id') : null,
			type: el.getAttribute ? el.getAttribute('data-type') : null,
			tagName: el.tagName,
			attributes: attrs
		};
	});

	return {
		content: [
			{
				type: 'text' as const,
				text: JSON.stringify(results, null, 2)
			}
		]
	};
}
