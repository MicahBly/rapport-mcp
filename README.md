# Rapport MCP Server

Model Context Protocol (MCP) server for [Rapport](https://rapport.dev) - enables AI agents like Claude to create and modify visual canvases.

## Features

- 🎨 **Canvas Manipulation** - Read and modify SVG canvases
- 🔍 **Element Queries** - Find specific elements using CSS selectors
- 📝 **Templates & Guides** - Get comprehensive editing instructions
- 🛡️ **Security Validation** - Built-in XSS and script injection prevention
- 🔐 **OAuth Authentication** - Seamless browser-based login flow

## Installation

```bash
npm install -g rapport-mcp
```

## Quick Start

### 1. Authenticate

```bash
rapport-mcp login
```

This will:
1. Open your browser to rapport.dev
2. Log you in (or use existing session)
3. Save your auth tokens locally
4. You're ready to go!

### 2. Configure Claude Desktop

Add to your `claude_desktop_config.json`:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

### 3. Restart Claude Desktop

That's it! Claude can now interact with your Rapport canvases.

## Available Tools

### `get_svg`
Get the SVG document and metadata for a canvas.

```typescript
{
  "project_id": "uuid",
  "include_metadata": true  // optional
}
```

### `get_canvas_template`
Get a comprehensive guide for modifying a canvas. **Use this first** before making changes!

```typescript
{
  "project_id": "uuid"
}
```

### `update_svg`
Update a canvas with new SVG content. Includes automatic security validation.

```typescript
{
  "project_id": "uuid",
  "svg_document": "<svg>...</svg>",
  "skip_validation": false  // optional, NOT recommended
}
```

### `query_elements`
Find elements using CSS selectors.

```typescript
{
  "project_id": "uuid",
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

- ✅ OAuth-based authentication (no manual token copying!)
- ✅ Tokens stored securely in `~/.rapport-mcp/config.json`
- ✅ Automatic XSS and script injection prevention
- ✅ Row Level Security (RLS) enforces project ownership
- ✅ Comprehensive SVG validation

## How It Works

1. User runs `rapport-mcp login`
2. Browser opens to rapport.dev for authentication
3. After login, tokens are sent to local callback server
4. Tokens saved to `~/.rapport-mcp/config.json`
5. MCP server uses tokens with Supabase RLS
6. Only user's own projects are accessible

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

### OAuth callback times out
Make sure port 3456 is available on your machine.

## Links

- 🌐 [Rapport](https://rapport.dev)
- 📖 [Agent Guide](./AGENT_GUIDE.md)
- 🐛 [Report Issues](https://github.com/MicahBly/rapport-mcp/issues)
- 📦 [npm Package](https://www.npmjs.com/package/rapport-mcp)

## License

MIT © Instant Unicorn

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.
