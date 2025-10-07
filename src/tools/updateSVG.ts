import { supabase } from '../db.js';
import { validateSVG, getSVGStats } from '../utils/svgValidator.js';

export interface UpdateSVGArgs {
	project_id: string;
	svg_document: string;
	skip_validation?: boolean; // For emergency overrides (use with caution)
	user_id?: string; // Optional: Verify user owns the project
}

export async function updateSVG(args: UpdateSVGArgs) {
	// Comprehensive validation
	const validation = validateSVG(args.svg_document);

	if (!validation.valid && !args.skip_validation) {
		const errorMessage = [
			'❌ SVG validation failed:',
			'',
			'**Errors:**',
			...validation.errors.map(e => `- ${e}`),
			'',
			validation.warnings.length > 0 ? '**Warnings:**' : '',
			...validation.warnings.map(w => `- ${w}`),
			'',
			'Please fix these issues and try again.',
			'If you believe this is a false positive, you can use skip_validation: true (NOT RECOMMENDED)'
		].filter(line => line !== '').join('\n');

		throw new Error(errorMessage);
	}

	// Use sanitized version if validation passed
	const svgToSave = validation.sanitized || args.svg_document;

	// Get stats for confirmation message
	const stats = getSVGStats(svgToSave);

	// Build update query with optional user verification
	let query = supabase
		.from('projects')
		.update({
			svg_document: svgToSave,
			updated_at: new Date().toISOString()
		})
		.eq('id', args.project_id);

	// If user_id provided, verify ownership
	if (args.user_id) {
		query = query.eq('user_id', args.user_id);
	}

	const { error } = await query;

	if (error) {
		const message = args.user_id
			? `Failed to update SVG: You don't have permission to modify this project`
			: `Failed to update SVG`;
		throw new Error(`${message}: ${error.message}`);
	}

	// Build success message
	const warningText = validation.warnings.length > 0
		? `\n\n⚠️  Warnings:\n${validation.warnings.map(w => `- ${w}`).join('\n')}`
		: '';

	const message = `✅ SVG updated successfully!

**Canvas Statistics:**
- Total elements: ${stats.totalElements}
- Size: ${stats.sizeKB} KB

**Element Breakdown:**
${Object.entries(stats.elementCounts)
	.filter(([_, count]) => count > 0)
	.map(([type, count]) => `- ${type}: ${count}`)
	.join('\n')}${warningText}`;

	return {
		content: [
			{
				type: 'text' as const,
				text: message
			}
		]
	};
}
