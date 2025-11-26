import { apiRequest, getUserId } from '../apiClient.js';
import { validateSVG, getSVGStats } from '../utils/svgValidator.js';

export interface UpdateSVGArgs {
	svg_document: string;
}

export async function updateSVG(args: UpdateSVGArgs) {
	const userId = getUserId();

	// Comprehensive validation
	const validation = validateSVG(args.svg_document);

	if (!validation.valid) {
		const errorMessage = [
			'❌ SVG validation failed:',
			'',
			'**Errors:**',
			...validation.errors.map(e => `- ${e}`),
			'',
			validation.warnings.length > 0 ? '**Warnings:**' : '',
			...validation.warnings.map(w => `- ${w}`),
			'',
			'Please fix these issues and try again.'
		].filter(line => line !== '').join('\n');

		throw new Error(errorMessage);
	}

	// Use sanitized version
	const svgToSave = validation.sanitized as string;

	// Get stats for confirmation message
	const stats = getSVGStats(svgToSave);

	// First, get the user's project ID
	const projectResponse = await apiRequest(`/api/projects/recent?userId=${userId}`);

	if (!projectResponse.project) {
		throw new Error('Failed to find your project');
	}

	// Update via API endpoint
	await apiRequest('/api/svg/save', {
		method: 'POST',
		body: JSON.stringify({
			projectId: projectResponse.project.id,
			svgDocument: svgToSave
		})
	});

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
