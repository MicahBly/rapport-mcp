import { supabase, getUserId } from '../db.js';

export interface GetSVGArgs {
	include_metadata?: boolean;
}

export async function getSVG(args: GetSVGArgs) {
	const userId = getUserId();

	const { data, error } = await supabase
		.from('projects')
		.select('id, svg_document, title, pins, updated_at, is_public, user_id')
		.eq('user_id', userId)
		.single();

	if (error) {
		throw new Error(`Project not found for your account - ${error.message}`);
	}

	// Parse SVG to get element count and canvas info
	const elementCount = (data.svg_document.match(/<(rect|circle|path|line|text|ellipse|polygon|polyline)/g) || []).length;
	const viewBoxMatch = data.svg_document.match(/viewBox="([^"]+)"/);
	const viewBox = viewBoxMatch ? viewBoxMatch[1] : 'unknown';

	let responseText = data.svg_document;

	if (args.include_metadata !== false) {
		const metadata = {
			project_id: data.id,
			title: data.title,
			element_count: elementCount,
			viewBox: viewBox,
			pins: data.pins || [],
			is_public: data.is_public || false,
			last_updated: data.updated_at
		};

		responseText = `# Canvas Metadata\n${JSON.stringify(metadata, null, 2)}\n\n# SVG Document\n${data.svg_document}`;
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
