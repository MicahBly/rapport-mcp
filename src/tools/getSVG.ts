import { supabase } from '../db.js';

export interface GetSVGArgs {
	project_id: string;
	include_metadata?: boolean;
	user_id?: string; // Optional: Verify user owns the project
}

export async function getSVG(args: GetSVGArgs) {
	let query = supabase
		.from('projects')
		.select('svg_document, title, pins, updated_at, is_public, user_id')
		.eq('id', args.project_id);

	// If user_id provided, verify ownership
	if (args.user_id) {
		query = query.eq('user_id', args.user_id);
	}

	const { data, error } = await query.single();

	if (error) {
		const message = args.user_id
			? `Project not found or you don't have access: ${args.project_id}`
			: `Project not found: ${args.project_id}`;
		throw new Error(`${message} - ${error.message}`);
	}

	// Parse SVG to get element count and canvas info
	const elementCount = (data.svg_document.match(/<(rect|circle|path|line|text|ellipse|polygon|polyline)/g) || []).length;
	const viewBoxMatch = data.svg_document.match(/viewBox="([^"]+)"/);
	const viewBox = viewBoxMatch ? viewBoxMatch[1] : 'unknown';

	let responseText = data.svg_document;

	if (args.include_metadata !== false) {
		const metadata = {
			project_id: args.project_id,
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
