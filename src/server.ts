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
			description: 'Get the SVG document and metadata for your Rapport canvas. Returns the current SVG along with canvas information like element count, viewBox, pins, and update history. Automatically fetches your canvas using your authenticated user account.',
			inputSchema: {
				type: 'object',
				properties: {
					include_metadata: {
						type: 'boolean',
						description: 'Include canvas metadata (default: true)',
						default: true
					}
				},
				required: []
			}
		},
		{
			name: 'get_canvas_template',
			description: 'Get a comprehensive template and guide for modifying your Rapport canvas. This provides the current canvas state plus detailed instructions on how to add/modify elements, including examples, security guidelines, and best practices. USE THIS FIRST before making any changes to understand the canvas structure. Automatically fetches your canvas using your authenticated user account.',
			inputSchema: {
				type: 'object',
				properties: {},
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
