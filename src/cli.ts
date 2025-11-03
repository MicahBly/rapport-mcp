#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '', '.rapport-mcp');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const POLL_INTERVAL = 2000; // 2 seconds
const POLL_TIMEOUT = 5 * 60 * 1000; // 5 minutes

interface Config {
	access_token?: string;
	refresh_token?: string;
	user_id?: string;
}

interface PollResponse {
	status: 'pending' | 'completed' | 'expired';
	access_token?: string;
	refresh_token?: string;
	user_id?: string;
}

function loadConfig(): Config {
	if (!fs.existsSync(CONFIG_FILE)) {
		return {};
	}
	return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
}

function saveConfig(config: Config) {
	if (!fs.existsSync(CONFIG_DIR)) {
		fs.mkdirSync(CONFIG_DIR, { recursive: true });
	}
	fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

async function pollForAuth(sessionId: string): Promise<PollResponse> {
	const pollUrl = `https://rapport.dev/api/mcp/auth/poll?session=${sessionId}`;

	try {
		const response = await fetch(pollUrl);

		if (response.status === 200) {
			// Authentication completed
			return await response.json();
		} else if (response.status === 202) {
			// Still pending
			return { status: 'pending' };
		} else if (response.status === 404 || response.status === 410) {
			// Session expired or invalid
			return { status: 'expired' };
		} else {
			// Unexpected status
			throw new Error(`Unexpected status: ${response.status}`);
		}
	} catch (error) {
		// Network error or other issue
		throw error;
	}
}

async function login() {
	console.log('🔐 Starting Rapport MCP authentication...\n');

	// Generate unique session ID
	const sessionId = randomUUID();
	const authUrl = `https://rapport.dev/mcp/auth?session=${sessionId}`;

	console.log(`🔗 Opening browser to authenticate...\n`);

	// Open browser
	const command = process.platform === 'darwin'
		? `open "${authUrl}"`
		: process.platform === 'win32'
		? `start "${authUrl}"`
		: `xdg-open "${authUrl}"`;

	try {
		execSync(command);
	} catch (error) {
		console.log(`\n⚠️  Could not open browser automatically.`);
		console.log(`Please open this URL manually:\n${authUrl}\n`);
	}

	console.log('⏳ Waiting for authentication...');
	console.log('   (Complete the authentication in your browser)\n');

	// Poll for authentication
	const startTime = Date.now();
	let attempts = 0;

	while (Date.now() - startTime < POLL_TIMEOUT) {
		attempts++;

		try {
			const result = await pollForAuth(sessionId);

			if (result.status === 'completed' && result.access_token && result.refresh_token && result.user_id) {
				// Authentication successful
				saveConfig({
					access_token: result.access_token,
					refresh_token: result.refresh_token,
					user_id: result.user_id
				});

				console.log('\n✅ Authentication successful!');
				console.log(`📝 User ID: ${result.user_id}`);
				console.log(`💾 Tokens saved to: ${CONFIG_FILE}\n`);
				process.exit(0);
			} else if (result.status === 'expired') {
				console.log('\n❌ Authentication session expired');
				console.log('Please run `rapport-mcp login` again\n');
				process.exit(1);
			}

			// Still pending, wait before next poll
			if (attempts % 10 === 0) {
				// Show progress every 20 seconds (10 attempts * 2 seconds)
				console.log(`   Still waiting... (${Math.floor((Date.now() - startTime) / 1000)}s elapsed)`);
			}

			await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));

		} catch (error) {
			// On error, wait a bit and retry
			await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
		}
	}

	// Timeout
	console.log('\n❌ Authentication timed out after 5 minutes');
	console.log('Please run `rapport-mcp login` again\n');
	process.exit(1);
}

function status() {
	const config = loadConfig();

	if (!config.access_token) {
		console.log('❌ Not authenticated');
		console.log('\nRun `rapport-mcp login` to authenticate\n');
		return;
	}

	console.log('✅ Authenticated');
	console.log(`📝 User ID: ${config.user_id}`);
	console.log(`💾 Config: ${CONFIG_FILE}\n`);
}

function logout() {
	if (fs.existsSync(CONFIG_FILE)) {
		fs.unlinkSync(CONFIG_FILE);
		console.log('✅ Logged out successfully\n');
	} else {
		console.log('ℹ️  Already logged out\n');
	}
}

async function startServer() {
	// Dynamically import and start the MCP server
	const serverPath = path.join(__dirname, 'server.js');
	await import(serverPath);
}

function showHelp() {
	console.log(`
Rapport MCP CLI

Usage:
  rapport-mcp           - Start MCP server (default)
  rapport-mcp login     - Authenticate with Rapport
  rapport-mcp status    - Check authentication status
  rapport-mcp logout    - Clear authentication
  rapport-mcp help      - Show this help message
	`);
}

// Main CLI
const command = process.argv[2];

switch (command) {
	case 'login':
		login();
		break;
	case 'status':
		status();
		break;
	case 'logout':
		logout();
		break;
	case 'help':
	case '--help':
	case '-h':
		showHelp();
		break;
	default:
		// No command provided - start MCP server (default behavior for Claude Code/Desktop)
		startServer().catch(error => {
			console.error('Failed to start server:', error);
			process.exit(1);
		});
}
