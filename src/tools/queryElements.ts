import { supabase, getUserId } from '../db.js';
import { DOMParser } from '@xmldom/xmldom';

export interface QueryElementsArgs {
	selector: string;
}

export async function queryElements(args: QueryElementsArgs) {
	const userId = getUserId();

	const { data, error } = await supabase
		.from('projects')
		.select('svg_document')
		.eq('user_id', userId)
		.single();

	if (error) {
		throw new Error(`Project not found for your account - ${error.message}`);
	}

	const parser = new DOMParser();
	const doc = parser.parseFromString(data.svg_document, 'image/svg+xml');

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
