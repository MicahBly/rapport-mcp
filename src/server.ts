#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	ListToolsRequestSchema,
	CallToolRequestSchema,
	McpError,
	ErrorCode
} from '@modelcontextprotocol/sdk/types.js';
import { getSVG } from './tools/getSVG.js';
import { updateSVG } from './tools/updateSVG.js';
import { queryElements } from './tools/queryElements.js';
import { getCanvasTemplate } from './tools/getCanvasTemplate.js';
import { exportOpenAPI } from './tools/exportOpenAPI.js';

const server = new Server(
	{
		name: 'rapport-mcp',
		version: '1.0.0'
	},
	{
		capabilities: {
			tools: {}
		}
	}
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
	tools: [
		{
			name: 'get_svg',
			description: 'Get the SVG document for your Rapport canvas. Returns the current SVG. Optionally include metadata. Automatically fetches your canvas using your authenticated user account.',
			inputSchema: {
				type: 'object',
				properties: {
					include_metadata: {
						type: 'boolean',
						description: 'Include canvas metadata (default: false for token efficiency)',
						default: false
					}
				},
				required: []
			}
		},
		{
			name: 'get_canvas_template',
			description: `Get canvas at specified detail level. DEFAULT: level 2 (SVG only).

LEVELS:
- 0: Metadata only (50 tokens) - quick status check
- 1: Summary (200 tokens) - element breakdown
- 2: SVG only (500-2000 tokens) - DEFAULT for editing
- 3: Full guide (1500-3000 tokens) - first interaction only

Use level=3 on FIRST interaction to learn format, then level=2 for subsequent edits.`,
			inputSchema: {
				type: 'object',
				properties: {
					detail_level: {
						type: 'integer',
						enum: [0, 1, 2, 3],
						default: 2,
						description: '0=metadata, 1=summary, 2=svg (default), 3=full guide'
					}
				},
				required: []
			}
		},
		{
			name: 'update_svg',
			description: 'Update the SVG document for your Rapport canvas. The SVG will be validated for security (no scripts, event handlers, or malicious content) and integrity before being saved. Returns detailed feedback about the update including element counts and any warnings. Automatically updates your canvas using your authenticated user account.',
			inputSchema: {
				type: 'object',
				properties: {
					svg_document: {
						type: 'string',
						description: 'The complete, valid SVG document as a string. Must include <svg> wrapper with xmlns and viewBox attributes. All elements must have unique IDs and appropriate data-type attributes.'
					},
					skip_validation: {
						type: 'boolean',
						description: 'Skip security validation (NOT RECOMMENDED - use only for emergency overrides)',
						default: false
					}
				},
				required: ['svg_document']
			}
		},
		{
			name: 'query_elements',
			description: 'Query and search for specific elements in your Rapport canvas using CSS-like selectors. Useful for finding elements by type, ID, or data attributes before modifying them. Automatically queries your canvas using your authenticated user account.',
			inputSchema: {
				type: 'object',
				properties: {
					selector: {
						type: 'string',
						description:
							'CSS selector (supports: tag names like "rect" or "circle", #id for specific elements, [data-type="value"] for element types)'
					}
				},
				required: ['selector']
			}
		},
		{
			name: 'export_openapi',
			description: 'Export API endpoints from your canvas as an OpenAPI specification. Scans the canvas for API-related semantic elements (API endpoints, gateways, etc.) and generates a complete OpenAPI 3.0/3.1 specification with paths, methods, schemas, and security requirements. Perfect for generating API documentation from architecture diagrams.',
			inputSchema: {
				type: 'object',
				properties: {
					format: {
						type: 'string',
						enum: ['json', 'yaml'],
						description: 'Output format (default: json)',
						default: 'json'
					},
					version: {
						type: 'string',
						enum: ['3.0', '3.1'],
						description: 'OpenAPI version (default: 3.0)',
						default: '3.0'
					},
					include_examples: {
						type: 'boolean',
						description: 'Include example requests/responses if defined (default: true)',
						default: true
					}
				},
				required: []
			}
		}
	]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
	const { name, arguments: args } = request.params;

	try {
		switch (name) {
			case 'get_svg':
				return await getSVG(args as any);
			case 'get_canvas_template':
				return await getCanvasTemplate(args as any);
			case 'update_svg':
				return await updateSVG(args as any);
			case 'query_elements':
				return await queryElements(args as any);
			case 'export_openapi':
				return await exportOpenAPI(args as any);
			default:
				throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
		}
	} catch (error) {
		if (error instanceof McpError) {
			throw error;
		}
		throw new McpError(
			ErrorCode.InternalError,
			`Tool execution failed: ${(error as Error).message}`
		);
	}
});

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error('Rapport MCP server running on stdio');
}

main().catch((error) => {
	console.error('Server error:', error);
	process.exit(1);
});
