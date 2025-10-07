import { supabase, getUserId } from '../db.js';
import { validateSVG, getSVGStats } from '../utils/svgValidator.js';

export interface UpdateSVGArgs {
	svg_document: string;
	skip_validation?: boolean; // For emergency overrides (use with caution)
}

export async function updateSVG(args: UpdateSVGArgs) {
	const userId = getUserId();

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

	// First, get the user's project to update
	const { data: project, error: fetchError } = await supabase
		.from('projects')
		.select('id')
		.eq('user_id', userId)
		.single();

	if (fetchError) {
		throw new Error(`Failed to find your project: ${fetchError.message}`);
	}

	// Update the project
	const { error } = await supabase
		.from('projects')
		.update({
			svg_document: svgToSave,
			updated_at: new Date().toISOString()
		})
		.eq('id', project.id)
		.eq('user_id', userId);

	if (error) {
		throw new Error(`Failed to update SVG: ${error.message}`);
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
