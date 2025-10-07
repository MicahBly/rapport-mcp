import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Lazy-load Supabase client to ensure environment variables are available
let _supabase: any = null;

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
		return {};
	}

	try {
		return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
	} catch (error) {
		return {};
	}
}

function getSupabaseClient() {
	if (!_supabase) {
		const supabaseUrl = process.env.SUPABASE_URL || 'https://vwfrbjxsomucesldsziy.supabase.co';
		const anonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3ZnJianhzb211Y2VzbGRzeml5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MjMwNDksImV4cCI6MjA3NTA5OTA0OX0.jsOP1wN5TyDZMdfq4yP0OrNMkaAi6CS70q-eiXlSr5w';

		// Load user's auth token from config
		const config = loadConfig();

		if (config.access_token) {
			// Create client with user's token
			_supabase = createClient(supabaseUrl, anonKey, {
				global: {
					headers: {
						Authorization: `Bearer ${config.access_token}`
					}
				}
			});
		} else {
			// No token - user needs to login
			throw new Error('Not authenticated. Run `rapport-mcp login` to authenticate.');
		}
	}
	return _supabase;
}

export function getUserId(): string {
	const config = loadConfig();
	if (!config.user_id) {
		throw new Error('Not authenticated. Run `rapport-mcp login` to authenticate.');
	}
	return config.user_id;
}

export const supabase = new Proxy({} as any, {
	get(target, prop) {
		return getSupabaseClient()[prop];
	}
});
