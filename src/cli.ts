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
const POLL_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const INITIAL_POLL_DELAY = 1000; // Start at 1 second
const MAX_POLL_DELAY = 10000; // Cap at 10 seconds
const BACKOFF_MULTIPLIER = 1.5; // Exponential factor

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
		fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
	}
	fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

function getBaseUrl(): string {
	return process.env.RAPPORT_API_URL || 'https://rapport.dev';
}

async function pollForAuth(sessionId: string): Promise<PollResponse> {
	const pollUrl = `${getBaseUrl()}/api/mcp/auth/poll?session=${sessionId}`;

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
	const authUrl = `${getBaseUrl()}/mcp/auth?session=${sessionId}`;

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

	// Poll for authentication with exponential backoff and jitter
	const startTime = Date.now();
	let attempts = 0;
	let currentDelay = INITIAL_POLL_DELAY;

	// Add jitter to prevent thundering herd (±20% randomization)
	const addJitter = (delay: number): number => {
		const jitter = delay * 0.2 * (Math.random() - 0.5) * 2;
		return Math.round(delay + jitter);
	};

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

			// Still pending - apply exponential backoff with jitter
			if (attempts % 5 === 0) {
				console.log(`   Still waiting... (${Math.floor((Date.now() - startTime) / 1000)}s elapsed)`);
			}

			const delayWithJitter = addJitter(currentDelay);
			await new Promise(resolve => setTimeout(resolve, delayWithJitter));

			// Increase delay for next iteration (exponential backoff)
			currentDelay = Math.min(currentDelay * BACKOFF_MULTIPLIER, MAX_POLL_DELAY);

		} catch (error) {
			// On error, apply larger backoff
			currentDelay = Math.min(currentDelay * 2, MAX_POLL_DELAY);
			const delayWithJitter = addJitter(currentDelay);
			await new Promise(resolve => setTimeout(resolve, delayWithJitter));
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
