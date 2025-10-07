#!/usr/bin/env node

import http from 'http';
import { URL } from 'url';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '', '.rapport-mcp');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const PORT = 3456;

interface Config {
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

async function login() {
	console.log('🔐 Starting Rapport MCP authentication...\n');

	const authUrl = `http://localhost:5176/mcp/auth?callback=http://localhost:${PORT}/callback`;

	// Start local callback server
	const server = http.createServer((req, res) => {
		const url = new URL(req.url!, `http://localhost:${PORT}`);

		if (url.pathname === '/callback') {
			const access_token = url.searchParams.get('access_token');
			const refresh_token = url.searchParams.get('refresh_token');
			const user_id = url.searchParams.get('user_id');

			if (!access_token || !refresh_token || !user_id) {
				res.writeHead(400, { 'Content-Type': 'text/html' });
				res.end('<h1>❌ Authentication Failed</h1><p>Missing token parameters</p>');
				server.close();
				process.exit(1);
			}

			// Save tokens
			saveConfig({ access_token, refresh_token, user_id });

			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.end(`
				<html>
					<head><title>Rapport MCP - Success</title></head>
					<body style="font-family: sans-serif; text-align: center; padding: 50px;">
						<h1 style="color: green;">✓ Authentication Successful!</h1>
						<p>You can close this window and return to your terminal.</p>
					</body>
				</html>
			`);

			console.log('\n✅ Authentication successful!');
			console.log(`📝 User ID: ${user_id}`);
			console.log(`💾 Tokens saved to: ${CONFIG_FILE}\n`);

			setTimeout(() => {
				server.close();
				process.exit(0);
			}, 1000);
		} else {
			res.writeHead(404);
			res.end('Not Found');
		}
	});

	server.listen(PORT, () => {
		console.log(`🌐 Callback server listening on http://localhost:${PORT}`);
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
	});

	// Timeout after 5 minutes
	setTimeout(() => {
		console.log('\n❌ Authentication timed out after 5 minutes');
		server.close();
		process.exit(1);
	}, 5 * 60 * 1000);
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
	default:
		console.log(`
Rapport MCP CLI

Usage:
  rapport-mcp login   - Authenticate with Rapport
  rapport-mcp status  - Check authentication status
  rapport-mcp logout  - Clear authentication
		`);
}
