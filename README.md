# Rapport MCP Server

Model Context Protocol (MCP) server for [Rapport](https://rapport.dev) - enables AI agents like Claude to create and modify visual canvases.

## Features

- 🎨 **Canvas Manipulation** - Read and modify SVG canvases
- 🔍 **Element Queries** - Find specific elements using CSS selectors
- 📝 **Templates & Guides** - Get comprehensive editing instructions
- 🛡️ **Security Validation** - Built-in XSS and script injection prevention
- 🔐 **OAuth Authentication** - Seamless browser-based login flow (works on remote servers!)

## Installation

### Option 1: Using Claude Code (Recommended)

```bash
# Install from npm
claude mcp add rapport-mcp

# Or use npx (no install required)
claude mcp add npx rapport-mcp

# Or for local development
claude mcp add npx /path/to/rapport-mcp
```

### Option 2: Global npm Install

```bash
npm install -g rapport-mcp
```

### Option 3: Use with npx (No Install)

```bash
# No installation needed - npx will run it on demand
npx rapport-mcp login
```

## Quick Start

### 1. Authenticate

```bash
rapport-mcp login
```

This will:
1. Generate a secure session ID
2. Open your browser to rapport.dev
3. Log you in (or use existing session)
4. Automatically detect when you've authenticated
5. Save your auth tokens locally
6. You're ready to go!

### 2. Configure Your AI Client

#### For Claude Code

Already done if you used `claude mcp add`! Otherwise:

```bash
claude mcp add rapport-mcp
```

#### For Claude Desktop

Add to your `claude_desktop_config.json`:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/claude/claude_desktop_config.json`

**Option A: With global install**
```json
{
  "mcpServers": {
    "rapport": {
      "command": "rapport-mcp",
      "args": []
    }
  }
}
```

**Option B: With npx (no install needed)**
```json
{
  "mcpServers": {
    "rapport": {
      "command": "npx",
      "args": ["-y", "rapport-mcp"]
    }
  }
}
```

**Option C: Local development**
```json
{
  "mcpServers": {
    "rapport": {
      "command": "npx",
      "args": ["-y", "/path/to/rapport-mcp"]
    }
  }
}
```

### 3. Restart Your AI Client

That's it! Claude can now interact with your Rapport canvases.

## Available Tools

### `get_svg`
Get the SVG document and metadata for your canvas.

```typescript
{
  "include_metadata": true  // optional
}
```

**Note**: Automatically uses your authenticated user account - no project ID needed!

### `get_canvas_template`
Get a comprehensive guide for modifying your canvas. **Use this first** before making changes!

```typescript
{}
```

### `update_svg`
Update your canvas with new SVG content. Includes automatic security validation.

```typescript
{
  "svg_document": "<svg>...</svg>",
  "skip_validation": false  // optional, NOT recommended
}
```

### `query_elements`
Find elements in your canvas using CSS selectors.

```typescript
{
  "selector": "rect[fill='blue']"
}
```

## CLI Commands

```bash
# Authenticate with Rapport
rapport-mcp login

# Check authentication status
rapport-mcp status

# Clear authentication
rapport-mcp logout
```

## Security

- ✅ OAuth-based authentication with automatic polling (no manual token copying!)
- ✅ Works on remote servers without localhost dependencies
- ✅ Tokens stored securely in `~/.rapport-mcp/config.json`
- ✅ Session-based flow with automatic expiration
- ✅ Automatic XSS and script injection prevention
- ✅ Row Level Security (RLS) enforces project ownership
- ✅ Comprehensive SVG validation

## How It Works

1. User runs `rapport-mcp login`
2. CLI generates a unique session ID
3. Browser opens to rapport.dev for authentication
4. After login, rapport.dev stores tokens server-side linked to session
5. CLI automatically polls for authentication completion
6. Once complete, tokens saved to `~/.rapport-mcp/config.json`
7. MCP server uses tokens with Supabase RLS
8. Only user's own projects are accessible

**Remote Server Friendly**: No localhost callback needed - works perfectly on remote servers via SSH!

## Example Usage with Claude

> "Get my canvas and add a blue rectangle in the center"

Claude will:
1. Use `get_canvas_template` to understand the structure
2. Use `get_svg` to fetch current canvas
3. Modify the SVG to add the rectangle
4. Use `update_svg` to save changes

## Development

```bash
# Clone the repository
git clone https://github.com/MicahBly/rapport-mcp.git
cd rapport-mcp

# Install dependencies
npm install

# Build
npm run build

# Test locally
node dist/cli.js login
```

## Troubleshooting

### "Not authenticated" error
Run `rapport-mcp login` to authenticate.

### "Project not found"
Make sure you're logged in with the correct account that owns the project.

### "SVG validation failed"
The SVG contains unsafe content (scripts, event handlers). Check the error message for details.

### OAuth authentication times out
The authentication flow times out after 5 minutes. If this happens:
1. Make sure you can access rapport.dev from your browser
2. Complete the authentication promptly after the browser opens
3. Check your internet connection
4. Try running `rapport-mcp login` again

## Links

- 🌐 [Rapport](https://rapport.dev)
- 📖 [Agent Guide](./AGENT_GUIDE.md)
- 🐛 [Report Issues](https://github.com/MicahBly/rapport-mcp/issues)
- 📦 [npm Package](https://www.npmjs.com/package/rapport-mcp)

## License

MIT © Instant Unicorn

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.
