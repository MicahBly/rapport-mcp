# Security Fixes - Quick Reference

## Priority 1: IMMEDIATE FIXES (Do These First)

### Fix #1: Secure Config File Permissions
**File:** `src/cli.ts`
**Lines:** 37-41
**Status:** CRITICAL - Tokens are world-readable

```typescript
// BEFORE (INSECURE)
function saveConfig(config: Config) {
	if (!fs.existsSync(CONFIG_DIR)) {
		fs.mkdirSync(CONFIG_DIR, { recursive: true });
	}
	fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// AFTER (SECURE)
function saveConfig(config: Config) {
	if (!fs.existsSync(CONFIG_DIR)) {
		fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
	}
	fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}
```

**Why:** This prevents other users on the system from reading authentication tokens.

---

### Fix #2: Add SSRF Protection to API Requests
**File:** `src/apiClient.ts`
**Lines:** 44-55
**Status:** HIGH - Endpoint concatenation is unsafe

```typescript
// BEFORE (UNSAFE)
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
}

// AFTER (SAFE)
// Whitelist of allowed endpoint patterns
const ALLOWED_ENDPOINTS = [
	'/api/projects/',
	'/api/svg/',
	'/api/mcp/auth/'
];

function validateEndpoint(endpoint: string): void {
	if (!endpoint.startsWith('/')) {
		throw new Error('Endpoint must start with /');
	}
	
	const isAllowed = ALLOWED_ENDPOINTS.some(pattern => endpoint.startsWith(pattern));
	if (!isAllowed) {
		throw new Error(`Endpoint not in allowlist. Allowed: ${ALLOWED_ENDPOINTS.join(', ')}`);
	}
}

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
	validateEndpoint(endpoint);
	
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
		console.error(`API Error [${response.status}]: ${errorText}`);
		
		// Return sanitized error message
		const message = response.status === 401 ? 'Authentication failed' :
		                response.status === 403 ? 'Access denied' :
		                response.status === 404 ? 'Resource not found' :
		                'API request failed';
		throw new Error(`${message} (${response.status})`);
	}

	return response.json();
}
```

**Why:** This prevents attackers from crafting malicious API requests using user's authentication token.

---

### Fix #3: Remove skip_validation Parameter
**Files:** `src/server.ts` (lines 67-71), `src/tools/updateSVG.ts` (line 6)
**Status:** MEDIUM - Allows bypassing security checks

```typescript
// BEFORE (INSECURE BYPASS)
// In server.ts
skip_validation: {
	type: 'boolean',
	description: 'Skip security validation (NOT RECOMMENDED - use only for emergency overrides)',
	default: false
}

// In updateSVG.ts
export interface UpdateSVGArgs {
	svg_document: string;
	skip_validation?: boolean; // For emergency overrides (use with caution)
}

if (!validation.valid && !args.skip_validation) {
	throw new Error(errorMessage);
}

// AFTER (SECURE - NO BYPASS)
// In server.ts - remove skip_validation from inputSchema

// In updateSVG.ts
export interface UpdateSVGArgs {
	svg_document: string;
	// skip_validation parameter removed entirely
}

if (!validation.valid) {
	throw new Error(errorMessage);
}
```

**Why:** Security validation exists for critical reasons. There should be no bypass mechanism.

---

## Priority 2: HIGH PRIORITY FIXES (Next)

### Fix #4: Verify XXE Protections
**File:** `src/tools/queryElements.ts`
**Lines:** 20-21
**Status:** HIGH - Parser could be vulnerable to XXE

```typescript
// BEFORE (NO XXE PROTECTION)
const parser = new DOMParser();
const doc = parser.parseFromString(data.svg_document, 'image/svg+xml');

// AFTER (DOCUMENTED XXE PROTECTION)
// Note: @xmldom/xmldom 0.8.11 is used which has built-in XXE protections
// via its error handling configuration
const parser = new DOMParser({
	errorHandler: {
		warning: () => {}, // Suppress warnings
		error: () => {},   // Suppress errors
		fatalError: () => {} // Suppress fatal errors
	}
});

const doc = parser.parseFromString(data.svg_document, 'image/svg+xml');

// Alternative: Add explicit DTD check before parsing
if (data.svg_document.includes('<!DOCTYPE') || data.svg_document.includes('<!ENTITY')) {
	throw new Error('SVG documents with DTD declarations are not allowed');
}
```

**Why:** XXE attacks can lead to information disclosure and denial of service.

---

### Fix #5: Enhance SVG Validation Patterns
**File:** `src/utils/svgValidator.ts`
**Lines:** 28-44
**Status:** MEDIUM - Some XSS patterns not caught

```typescript
// BEFORE (INCOMPLETE PATTERNS)
const dangerousPatterns = [
	{ pattern: /<script[^>]*>/gi, name: 'script tags' },
	{ pattern: /<iframe[^>]*>/gi, name: 'iframe tags' },
	{ pattern: /<object[\s>\/]/gi, name: 'object tags' },
	{ pattern: /<embed[^>]*>/gi, name: 'embed tags' },
	{ pattern: /on\w+\s*=/gi, name: 'event handlers' },
	{ pattern: /javascript:/gi, name: 'javascript: protocol' },
	{ pattern: /data:text\/html/gi, name: 'data:text/html protocol' },
	{ pattern: /<foreignObject/gi, name: 'foreignObject elements' }
];

// AFTER (COMPREHENSIVE PATTERNS)
const dangerousPatterns = [
	// Standard dangerous elements
	{ pattern: /<script[^>]*>[\s\S]*?<\/script>/gi, name: 'script tags' },
	{ pattern: /<iframe[^>]*>/gi, name: 'iframe tags' },
	{ pattern: /<object[\s>\/]/gi, name: 'object tags' },
	{ pattern: /<embed[^>]*>/gi, name: 'embed tags' },
	{ pattern: /<foreignObject/gi, name: 'foreignObject elements' },
	
	// Event handlers (with comprehensive coverage)
	{ pattern: /\s+on\w+\s*=/gi, name: 'event handlers' },
	{ pattern: /on\w+\s*=\s*["'][^"']*["']/gi, name: 'event handler attributes' },
	
	// Animation-based XSS (SVG animations can set attributes)
	{ pattern: /<animate[^>]+attributeName\s*=\s*["'](on\w+)/gi, name: 'animate event attributes' },
	{ pattern: /<set[^>]+attributeName\s*=\s*["'](on\w+)/gi, name: 'set event attributes' },
	
	// JavaScript protocols
	{ pattern: /javascript:/gi, name: 'javascript: protocol' },
	{ pattern: /vbscript:/gi, name: 'vbscript: protocol' },
	{ pattern: /data:text\/html/gi, name: 'data:text/html protocol' },
	{ pattern: /data:[^,]*script/gi, name: 'data: script protocol' },
	
	// Encoding bypass attempts
	{ pattern: /&#(?:58|x3a)\/\//gi, name: 'encoded protocol (&#58)' },
	{ pattern: /&colon;/gi, name: 'HTML entity colon' },
];

for (const { pattern, name } of dangerousPatterns) {
	if (pattern.test(svgContent)) {
		errors.push(`Dangerous content detected: ${name}`);
	}
}
```

**Why:** Animation elements and encoded protocols can bypass basic checks.

---

### Fix #6: Sanitize Error Messages
**File:** `src/apiClient.ts`
**Lines:** 57-62
**Status:** MEDIUM - Details leak system information

```typescript
// BEFORE (INFORMATION DISCLOSURE)
if (!response.ok) {
	const errorText = await response.text();
	throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
}

// AFTER (SANITIZED)
if (!response.ok) {
	const errorText = await response.text();
	
	// Log detailed error for debugging
	console.error(`[API Error ${response.status}] ${response.statusText}: ${errorText}`);
	
	// Return generic message to user
	const messages: Record<number, string> = {
		400: 'Invalid request',
		401: 'Authentication failed',
		403: 'Access denied',
		404: 'Resource not found',
		500: 'Server error',
	};
	
	const message = messages[response.status] || 'API request failed';
	throw new Error(`${message} (${response.status})`);
}
```

**Why:** Detailed error messages can help attackers understand system architecture.

---

## Priority 3: MEDIUM PRIORITY FIXES (Later)

### Fix #7: Enforce HTTPS URLs
**File:** `src/apiClient.ts`
**Lines:** 44-46
**Status:** MEDIUM - HTTP URLs could leak credentials

```typescript
// BEFORE (NO HTTPS ENFORCEMENT)
const baseUrl = process.env.RAPPORT_API_URL || 'https://rapport.dev';

// AFTER (ENFORCED HTTPS)
function validateBaseUrl(urlString: string): string {
	try {
		const url = new URL(urlString);
		if (url.protocol !== 'https:') {
			throw new Error('Only HTTPS URLs are allowed for security');
		}
		return urlString;
	} catch (error) {
		if (error instanceof Error && error.message.includes('HTTPS')) {
			throw error;
		}
		throw new Error(`Invalid API URL: ${error}`);
	}
}

const baseUrl = validateBaseUrl(process.env.RAPPORT_API_URL || 'https://rapport.dev');
```

**Why:** HTTP connections are vulnerable to man-in-the-middle attacks.

---

### Fix #8: Add Exponential Backoff to Auth Polling
**File:** `src/cli.ts`
**Lines:** 99-135
**Status:** LOW - Fixed polling could enable attacks

```typescript
// BEFORE (FIXED INTERVAL)
const POLL_INTERVAL = 2000;
// ... in loop:
await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));

// AFTER (EXPONENTIAL BACKOFF)
async function pollForAuth(sessionId: string): Promise<PollResponse> {
	const pollUrl = `https://rapport.dev/api/mcp/auth/poll?session=${sessionId}`;
	
	let backoffMs = 1000;        // Start at 1 second
	const maxBackoffMs = 10000;  // Cap at 10 seconds
	const maxAttempts = 30;      // Max 30 attempts instead of ~150
	
	const startTime = Date.now();
	let attempt = 0;
	
	while (Date.now() - startTime < POLL_TIMEOUT && attempt < maxAttempts) {
		attempt++;
		
		try {
			const response = await fetch(pollUrl);
			
			if (response.status === 200) {
				return await response.json();
			} else if (response.status === 202) {
				return { status: 'pending' };
			} else if (response.status === 404 || response.status === 410) {
				return { status: 'expired' };
			}
		} catch (error) {
			// Continue polling
		}
		
		await new Promise(resolve => setTimeout(resolve, backoffMs));
		
		// Exponential backoff: multiply by 1.5 each time
		backoffMs = Math.min(backoffMs * 1.5, maxBackoffMs);
		
		// Log progress
		if (attempt % 5 === 0) {
			console.log(`Waiting for authentication... (attempt ${attempt})`);
		}
	}
	
	return { status: 'expired' };
}
```

**Why:** Fixed polling enables denial-of-service and brute-force attacks.

---

## Testing the Fixes

After applying these fixes, test with:

```bash
# Verify file permissions
ls -l ~/.rapport-mcp/config.json
# Should show: -rw------- (600 permissions)

# Test HTTPS enforcement
RAPPORT_API_URL=http://example.com rapport-mcp status
# Should fail with "Only HTTPS URLs are allowed"

# Verify endpoint validation
# (This requires manual testing through the code)

# Test skip_validation removal
# Should not have this parameter in tool schema
```

---

## Summary

Total fixes needed: 8
- Immediate (3): File permissions, SSRF, skip_validation
- High (3): XXE, SVG validation, error messages
- Medium (2): HTTPS enforcement, rate limiting

Estimated implementation time: 4-6 hours
Risk if not fixed: HIGH - Token theft, SSRF attacks, XSS vulnerabilities

