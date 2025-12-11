import fs from 'fs';
import path from 'path';

// Supabase configuration - fetched from rapport.dev or environment
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://oztmxtowxddowhebrhfm.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96dG14dG93eGRkb3doZWJyaGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzA5MjgsImV4cCI6MjA4MDc0NjkyOH0._mQnWTqv0Q1qd4X7Vf7evecN3-IRPo6-6FT1qom2e8c';

interface Config {
	access_token?: string;
	refresh_token?: string;
	user_id?: string;
}

function getConfigPath(): string {
	return path.join(
		process.env.HOME || process.env.USERPROFILE || '',
		'.rapport-mcp',
		'config.json'
	);
}

function loadConfig(): Config {
	const configPath = getConfigPath();

	if (!fs.existsSync(configPath)) {
		throw new Error('Not authenticated. Run `rapport-mcp login` to authenticate.');
	}

	try {
		return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
	} catch (error) {
		throw new Error('Failed to load authentication config');
	}
}

function saveConfig(config: Config): void {
	const configPath = getConfigPath();
	const configDir = path.dirname(configPath);

	if (!fs.existsSync(configDir)) {
		fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
	}
	fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
}

/**
 * Parse JWT and extract expiration time
 */
function parseJwtExpiration(token: string): number | null {
	try {
		const parts = token.split('.');
		if (parts.length !== 3) return null;

		const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
		return payload.exp || null;
	} catch {
		return null;
	}
}

/**
 * Check if token is expired or will expire within the buffer time
 */
function isTokenExpired(token: string, bufferSeconds: number = 300): boolean {
	const exp = parseJwtExpiration(token);
	if (!exp) return true;

	const now = Math.floor(Date.now() / 1000);
	return exp <= (now + bufferSeconds);
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string } | null> {
	try {
		const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'apikey': SUPABASE_ANON_KEY,
			},
			body: JSON.stringify({ refresh_token: refreshToken }),
		});

		if (!response.ok) {
			console.error(`Token refresh failed: ${response.status} ${response.statusText}`);
			return null;
		}

		const data = await response.json();
		return {
			access_token: data.access_token,
			refresh_token: data.refresh_token,
		};
	} catch (error) {
		console.error('Token refresh error:', error);
		return null;
	}
}

/**
 * Get a valid access token, refreshing if necessary
 */
async function getValidAccessToken(): Promise<string> {
	const config = loadConfig();

	if (!config.access_token) {
		throw new Error('Not authenticated. Run `rapport-mcp login` to authenticate.');
	}

	// Check if token is expired or expiring soon (within 5 minutes)
	if (isTokenExpired(config.access_token, 300)) {
		if (!config.refresh_token) {
			throw new Error('Token expired and no refresh token available. Run `rapport-mcp login` to re-authenticate.');
		}

		console.error('Access token expired, refreshing...');
		const newTokens = await refreshAccessToken(config.refresh_token);

		if (!newTokens) {
			throw new Error('Failed to refresh token. Run `rapport-mcp login` to re-authenticate.');
		}

		// Save new tokens
		config.access_token = newTokens.access_token;
		config.refresh_token = newTokens.refresh_token;
		saveConfig(config);

		console.error('Token refreshed successfully');
		return newTokens.access_token;
	}

	return config.access_token;
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

	// Get a valid token (refreshes if needed)
	const token = await getValidAccessToken();

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

	// If we get a 401, try refreshing the token once more
	if (response.status === 401) {
		const config = loadConfig();
		if (config.refresh_token) {
			console.error('Got 401, attempting token refresh...');
			const newTokens = await refreshAccessToken(config.refresh_token);

			if (newTokens) {
				config.access_token = newTokens.access_token;
				config.refresh_token = newTokens.refresh_token;
				saveConfig(config);

				// Retry the request with new token
				const retryResponse = await fetch(url.toString(), {
					...options,
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${newTokens.access_token}`,
						...options.headers,
					},
				});

				if (!retryResponse.ok) {
					const errorBody = await retryResponse.text().catch(() => '');
					throw new Error(`API request failed: ${retryResponse.status} ${retryResponse.statusText}${errorBody ? ` - ${errorBody}` : ''}`);
				}

				const contentType = retryResponse.headers.get('Content-Type') || '';
				if (!contentType.includes('application/json')) {
					throw new Error(`Unexpected response format: expected JSON but received ${contentType || 'unknown'}`);
				}

				return retryResponse.json();
			}
		}
		throw new Error('Authentication failed. Run `rapport-mcp login` to re-authenticate.');
	}

	if (!response.ok) {
		// Include error body for better debugging
		const errorBody = await response.text().catch(() => '');
		throw new Error(`API request failed: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`);
	}

	// Validate Content-Type before parsing
	const contentType = response.headers.get('Content-Type') || '';
	if (!contentType.includes('application/json')) {
		throw new Error(`Unexpected response format: expected JSON but received ${contentType || 'unknown'}`);
	}

	return response.json();
}
