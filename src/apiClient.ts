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

	const response = await fetch(`${baseUrl}${endpoint}`, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${token}`,
			...options.headers,
		},
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
	}

	return response.json();
}
