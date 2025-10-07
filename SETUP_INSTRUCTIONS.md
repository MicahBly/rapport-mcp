# Setup Instructions for Publishing rapport-mcp

## Step 1: Create Public GitHub Repository

1. Go to https://github.com/new
2. **Repository name**: `rapport-mcp`
3. **Description**: "Model Context Protocol server for Rapport - AI-powered visual canvas editing"
4. **Visibility**: ✅ **Public** (required for npm)
5. **Initialize**: Leave unchecked (we have files already)
6. Click **Create repository**

## Step 2: Push Code to GitHub

```bash
cd /workspace/rapport-mcp-publish

# Initialize git
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial release of rapport-mcp

Model Context Protocol server for Rapport with OAuth authentication.

Features:
- OAuth browser-based login flow
- Secure token storage
- SVG canvas manipulation
- Element queries
- Security validation
- RLS-enforced project ownership
"

# Add remote (replace with your actual URL)
git remote add origin https://github.com/MicahBly/rapport-mcp.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 3: Prepare for npm Publishing

### 3a. Create npm Account (if you don't have one)
1. Go to https://www.npmjs.com/signup
2. Create account
3. Verify email

### 3b. Login to npm
```bash
npm login
# Enter username, password, email
```

### 3c. Check package name availability
```bash
npm search rapport-mcp
```

If taken, you may need to use a scoped package: `@your-org/rapport-mcp`

## Step 4: Build and Test Locally

```bash
cd /workspace/rapport-mcp-publish

# Install dependencies
npm install

# Build the project
npm run build

# Test the CLI locally
node dist/cli.js

# Test installation (optional)
npm link
rapport-mcp --help
```

## Step 5: Publish to npm

```bash
# Dry run to see what will be published
npm publish --dry-run

# Actually publish (first time)
npm publish

# For subsequent updates:
# 1. Update version in package.json (e.g., 1.0.1)
# 2. Commit changes
# 3. Create git tag: git tag v1.0.1
# 4. Push tag: git push --tags
# 5. Publish: npm publish
```

## Step 6: Verify Publication

1. Check npm: https://www.npmjs.com/package/rapport-mcp
2. Test global install:
   ```bash
   npm install -g rapport-mcp
   rapport-mcp --help
   ```

## Step 7: Add to MCP Registry (Optional but Recommended)

1. Fork https://github.com/modelcontextprotocol/servers
2. Add your server to the README.md
3. Create a Pull Request

Example entry:
```markdown
### Rapport MCP
AI-powered visual canvas editing for Rapport

- [GitHub](https://github.com/MicahBly/rapport-mcp)
- [npm](https://www.npmjs.com/package/rapport-mcp)
```

## Ongoing Maintenance

### Releasing New Versions

1. Make changes to code
2. Update `version` in package.json (follow semantic versioning)
3. Update CHANGELOG or README with changes
4. Commit: `git commit -am "Release v1.x.x"`
5. Tag: `git tag v1.x.x`
6. Push: `git push && git push --tags`
7. Publish: `npm publish`

### Semantic Versioning
- **1.0.0** → **1.0.1**: Bug fixes (patch)
- **1.0.0** → **1.1.0**: New features, backward compatible (minor)
- **1.0.0** → **2.0.0**: Breaking changes (major)

## Security Notes

- ✅ `.env` is in `.gitignore` - never commit secrets
- ✅ Only `dist/` files are published to npm (check `.npmignore`)
- ✅ Source code is on GitHub, built files on npm
- ✅ Users authenticate via OAuth (no shared secrets)

## Support

- Issues: https://github.com/MicahBly/rapport-mcp/issues
- Discussions: https://github.com/MicahBly/rapport-mcp/discussions
- Email: support@rapport.dev

## Checklist Before Publishing

- [ ] All tests pass (if you have tests)
- [ ] README.md is complete and accurate
- [ ] package.json version is correct
- [ ] LICENSE file is included
- [ ] .gitignore excludes sensitive files
- [ ] .npmignore only ships necessary files
- [ ] Build runs successfully (`npm run build`)
- [ ] CLI works (`node dist/cli.js`)
- [ ] GitHub repo is public
- [ ] You're logged into npm (`npm whoami`)

Ready to publish! 🚀
