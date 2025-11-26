import { apiRequest, getUserId } from '../apiClient.js';
import { JSDOM } from 'jsdom';

export interface ExportOpenAPIArgs {
	format?: 'json' | 'yaml';
	version?: '3.0' | '3.1';
	include_examples?: boolean;
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

interface APIEndpoint {
	id: string;
	name: string;
	method?: string;
	path?: string;
	description?: string;
	requestSchema?: any;
	responseSchema?: any;
	authenticated?: boolean;
	tags?: string[];
}

export async function exportOpenAPI(args: ExportOpenAPIArgs) {
	const userId = getUserId();
	const format = args.format || 'json';
	const version = args.version || '3.0';
	const includeExamples = args.include_examples !== false;

	// Fetch the canvas
	const response = await apiRequest(`/api/projects/recent?userId=${userId}`);

	if (!response.project) {
		throw new Error('Project not found for your account');
	}

	const data = response.project;
	const svgDocument = data.svg_document;

	// XXE protection: validate before parsing
	validateXMLSafety(svgDocument);

	// Use JSDOM for safer XML parsing (no XXE by default)
	const dom = new JSDOM(svgDocument, { contentType: 'image/svg+xml' });
	const doc = dom.window.document;

	// Query all objects with semantic types
	const objects = doc.querySelectorAll('[data-semantic-type]');
	const apiEndpoints: APIEndpoint[] = [];

	objects.forEach((obj) => {
		const semanticType = obj.getAttribute('data-semantic-type');

		// Only process API-related types
		if (!['api-endpoint', 'api-gateway', 'graphql-endpoint', 'websocket'].includes(semanticType || '')) {
			return;
		}

		const objectData = obj.querySelector('metadata > object-data');
		if (!objectData) return;

		const id = obj.getAttribute('id') || '';
		const nameEl = objectData.querySelector('name');
		const semanticMetadataEl = objectData.querySelector('semantic-metadata');

		const name = nameEl?.textContent || id;
		let metadata: any = {};

		try {
			if (semanticMetadataEl?.textContent) {
				metadata = JSON.parse(semanticMetadataEl.textContent);
			}
		} catch (e) {
			// If metadata parsing fails, use empty object
		}

		const endpoint: APIEndpoint = {
			id,
			name,
			method: metadata.httpMethod || 'GET',
			path: metadata.path || `/${name.toLowerCase().replace(/\s+/g, '-')}`,
			description: metadata.description || '',
			authenticated: metadata.authenticated || false,
			tags: metadata.tags || []
		};

		// Parse request/response schemas if present
		try {
			if (metadata.requestSchema) {
				endpoint.requestSchema = typeof metadata.requestSchema === 'string'
					? JSON.parse(metadata.requestSchema)
					: metadata.requestSchema;
			}
			if (metadata.responseSchema) {
				endpoint.responseSchema = typeof metadata.responseSchema === 'string'
					? JSON.parse(metadata.responseSchema)
					: metadata.responseSchema;
			}
		} catch (e) {
			// If schema parsing fails, skip it
		}

		apiEndpoints.push(endpoint);
	});

	if (apiEndpoints.length === 0) {
		return {
			content: [
				{
					type: 'text' as const,
					text: 'No API endpoints found in canvas. Add API endpoint elements using the Developer Elements tool (press K) and set their metadata in the Inspector panel.'
				}
			]
		};
	}

	// Generate OpenAPI spec
	const openAPISpec = generateOpenAPISpec(apiEndpoints, version, data.title || 'API', includeExamples);

	// Format output
	let output: string;
	if (format === 'yaml') {
		// Simple YAML conversion (for full YAML support, add 'js-yaml' package)
		output = jsonToSimpleYaml(openAPISpec);
	} else {
		output = JSON.stringify(openAPISpec, null, 2);
	}

	return {
		content: [
			{
				type: 'text' as const,
				text: `# OpenAPI ${version} Specification\n\nFound ${apiEndpoints.length} API endpoints in canvas.\n\n\`\`\`${format}\n${output}\n\`\`\``
			}
		]
	};
}

function generateOpenAPISpec(endpoints: APIEndpoint[], version: string, title: string, includeExamples: boolean): any {
	const spec: any = {
		openapi: version === '3.1' ? '3.1.0' : '3.0.0',
		info: {
			title: title,
			version: '1.0.0',
			description: 'Generated from Rapport canvas'
		},
		paths: {}
	};

	// Group endpoints by path
	endpoints.forEach((endpoint) => {
		const path = endpoint.path || '/';
		const method = (endpoint.method || 'get').toLowerCase();

		if (!spec.paths[path]) {
			spec.paths[path] = {};
		}

		const operation: any = {
			summary: endpoint.name,
			description: endpoint.description || endpoint.name,
			tags: endpoint.tags && endpoint.tags.length > 0 ? endpoint.tags : ['default']
		};

		// Add security if authenticated
		if (endpoint.authenticated) {
			operation.security = [{ bearerAuth: [] }];
		}

		// Add request body if schema exists
		if (endpoint.requestSchema) {
			operation.requestBody = {
				required: true,
				content: {
					'application/json': {
						schema: endpoint.requestSchema
					}
				}
			};

			if (includeExamples && endpoint.requestSchema.example) {
				operation.requestBody.content['application/json'].example = endpoint.requestSchema.example;
			}
		}

		// Add responses
		operation.responses = {
			'200': {
				description: 'Successful response'
			}
		};

		if (endpoint.responseSchema) {
			operation.responses['200'].content = {
				'application/json': {
					schema: endpoint.responseSchema
				}
			};

			if (includeExamples && endpoint.responseSchema.example) {
				operation.responses['200'].content['application/json'].example = endpoint.responseSchema.example;
			}
		}

		spec.paths[path][method] = operation;
	});

	// Add security schemes if any endpoint is authenticated
	const hasAuth = endpoints.some(e => e.authenticated);
	if (hasAuth) {
		spec.components = {
			securitySchemes: {
				bearerAuth: {
					type: 'http',
					scheme: 'bearer',
					bearerFormat: 'JWT'
				}
			}
		};
	}

	return spec;
}

function jsonToSimpleYaml(obj: any, indent = 0): string {
	const spaces = '  '.repeat(indent);
	let yaml = '';

	for (const [key, value] of Object.entries(obj)) {
		if (value === null || value === undefined) {
			yaml += `${spaces}${key}: null\n`;
		} else if (typeof value === 'object' && !Array.isArray(value)) {
			yaml += `${spaces}${key}:\n${jsonToSimpleYaml(value, indent + 1)}`;
		} else if (Array.isArray(value)) {
			yaml += `${spaces}${key}:\n`;
			value.forEach(item => {
				if (typeof item === 'object') {
					yaml += `${spaces}  -\n${jsonToSimpleYaml(item, indent + 2)}`;
				} else {
					yaml += `${spaces}  - ${item}\n`;
				}
			});
		} else if (typeof value === 'string') {
			yaml += `${spaces}${key}: "${value}"\n`;
		} else {
			yaml += `${spaces}${key}: ${value}\n`;
		}
	}

	return yaml;
}
