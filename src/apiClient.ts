import fs from 'fs';
import path from 'path';

interface Config {
	access_token?: string;
	refresh_token?: string;
	user_id?: string;
}

function loadConfig(): Config {
	const configPath = path.join(
		process.env.HOME || process.env.USERPROFILE || '',
		'.rapport-mcp',
		'config.json'
	);

	if (!fs.existsSync(configPath)) {
		throw new Error('Not authenticated. Run `rapport-mcp login` to authenticate.');
	}

	try {
		return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
	} catch (error) {
		throw new Error('Failed to load authentication config');
	}
}

export function getUserId(): string {
	const config = loadConfig();
	if (!config.user_id) {
		throw new Error('Not authenticated. Run `rapport-mcp login` to authenticate.');
	}
	return config.user_id;
}

export function getAuthToken(): string {
	const config = loadConfig();
	if (!config.access_token) {
		throw new Error('Not authenticated. Run `rapport-mcp login` to authenticate.');
	}
	return config.access_token;
}

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
	const baseUrl = process.env.RAPPORT_API_URL || 'https://rapport.dev';
	const token = getAuthToken();

	// Validate and construct the URL to prevent SSRF
	const url = new URL(endpoint, baseUrl);

	// Check if this is a local development environment
	const isLocalDev = url.hostname === 'localhost' ||
		url.hostname === '127.0.0.1' ||
		url.hostname.startsWith('192.168.') ||
		url.hostname.startsWith('10.') ||
		url.hostname.startsWith('100.'); // Tailscale

	if (!isLocalDev) {
		// Enforce HTTPS for production
		if (url.protocol !== 'https:') {
			throw new Error('API requests must use HTTPS.');
		}

		// Allow only rapport.dev subdomains in production
		if (!url.hostname.endsWith('.rapport.dev') && url.hostname !== 'rapport.dev') {
			throw new Error(`Invalid API endpoint: ${url.hostname}`);
		}
	}

	const response = await fetch(url.toString(), {
		...options,
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${token}`,
			...options.headers,
		},
	});

	if (!response.ok) {
		// Avoid leaking sensitive error details
		throw new Error(`API request failed: ${response.status} ${response.statusText}`);
	}

	// Validate Content-Type before parsing
	const contentType = response.headers.get('Content-Type') || '';
	if (!contentType.includes('application/json')) {
		throw new Error(`Unexpected response format: expected JSON but received ${contentType || 'unknown'}`);
	}

	return response.json();
}
