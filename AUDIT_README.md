# Security Audit - Documentation Index

This directory contains a comprehensive security audit of the rapport-mcp project.

## Files in This Audit

### 1. **SECURITY_AUDIT.md** (Main Report)
The complete security audit report with:
- Executive summary
- Detailed vulnerability descriptions
- Impact assessments
- Recommended fixes with code examples
- Risk analysis and mitigation strategies

**Read this first for full context.**

### 2. **SECURITY_FIXES.md** (Implementation Guide)
Quick reference guide for implementing security fixes:
- Organized by priority level
- Before/after code examples
- Explanation of why each fix is needed
- Testing instructions

**Use this when implementing fixes.**

### 3. **AUDIT_README.md** (This File)
Index and overview of the audit documentation.

---

## Quick Summary

**Total Vulnerabilities Found: 9**
- 3 HIGH severity
- 4 MEDIUM severity  
- 2 LOW severity

**Critical Issues:**
1. Insecure file permissions on authentication tokens (anyone can read them)
2. SSRF vulnerability in API endpoint handling
3. Potential XXE vulnerability in XML parser
4. Security validation bypass mechanism (skip_validation flag)
5. Incomplete SVG validation allowing some XSS patterns

---

## Remediation Timeline

### Immediate (This Week)
- [ ] Fix #1: Secure file permissions on config files
- [ ] Fix #2: Add SSRF protection with endpoint allowlist
- [ ] Fix #4: Remove skip_validation parameter

### Soon (Next 1-2 Weeks)
- [ ] Fix #3: Verify/enhance XXE protections
- [ ] Fix #5: Enhance SVG validation patterns
- [ ] Fix #6: Sanitize API error messages

### Later (Next Month)
- [ ] Fix #7: Enforce HTTPS URL validation
- [ ] Fix #8: Add exponential backoff to auth polling

---

## Key Findings

### Most Critical Issues

1. **Token File Permissions** (CRITICAL)
   - Location: ~/.rapport-mcp/config.json
   - Problem: Created with world-readable permissions (644)
   - Impact: Any system user can steal authentication tokens
   - Fix Time: 5 minutes
   - Fix: Use fs.mkdirSync(..., {mode: 0o700}) and writeFileSync(..., {mode: 0o600})

2. **SSRF in API Requests** (HIGH)
   - Location: apiClient.ts - apiRequest() function
   - Problem: Endpoint parameter concatenated without validation
   - Impact: Attackers could craft malicious API requests with user tokens
   - Fix Time: 15 minutes
   - Fix: Implement endpoint allowlist validation

3. **Security Bypass Flag** (HIGH)
   - Location: server.ts and updateSVG.ts
   - Problem: skip_validation parameter allows bypassing all security checks
   - Impact: Malicious SVG with XSS can be saved
   - Fix Time: 10 minutes
   - Fix: Remove the skip_validation parameter entirely

---

## Positive Findings

The project demonstrates good security practices in several areas:
- ✓ Comprehensive SVG validation with multiple security layers
- ✓ Proper use of Bearer token authentication
- ✓ Input sanitization for scripts and dangerous elements
- ✓ No eval() or dynamic code execution
- ✓ TypeScript strict mode enabled
- ✓ Cryptographically secure random UUID generation
- ✓ No hardcoded secrets
- ✓ Zero known vulnerabilities in dependencies

---

## Implementation Checklist

### Before You Start
- [ ] Read SECURITY_AUDIT.md completely
- [ ] Understand the impact of each vulnerability
- [ ] Plan implementation schedule

### Immediate Fixes
- [ ] Fix #1: File permissions on config
- [ ] Fix #2: SSRF protection
- [ ] Fix #3: Remove skip_validation
- [ ] Run npm run build
- [ ] Test all affected tools

### Secondary Fixes
- [ ] Fix #4: XXE protection documentation
- [ ] Fix #5: Enhanced SVG validation
- [ ] Fix #6: Error message sanitization
- [ ] Run full test suite

### Final Fixes
- [ ] Fix #7: HTTPS URL validation
- [ ] Fix #8: Auth polling exponential backoff
- [ ] Security testing
- [ ] Documentation update

### After Implementation
- [ ] [ ] Run: npm audit (should still show 0 vulnerabilities)
- [ ] [ ] Run: npm run build (should compile without errors)
- [ ] [ ] Manual testing of each tool
- [ ] [ ] Update version number
- [ ] [ ] Commit changes with detailed message
- [ ] [ ] Tag release with security fixes

---

## Verification Commands

```bash
# Check for security vulnerabilities in dependencies
npm audit

# Verify build succeeds
npm run build

# Check file permissions on config
ls -la ~/.rapport-mcp/config.json

# Should show:
# -rw------- (600) after fix
# NOT: -rw-rw-r-- (664)

# Test HTTPS enforcement
RAPPORT_API_URL=http://localhost rapport-mcp status
# Should error with "Only HTTPS URLs allowed"
```

---

## Questions and Clarifications

If you have any questions about the audit findings:
1. Review the detailed explanation in SECURITY_AUDIT.md
2. Check the code examples in SECURITY_FIXES.md
3. Refer to the impact assessment sections

---

## References

- OWASP Top 10: https://owasp.org/Top10/
- CWE-434: Unrestricted Upload of File with Dangerous Type
- CWE-798: Use of Hard-Coded Credentials
- CWE-611: Improper Restriction of XML External Entity Reference
- CWE-1: Improper Neutralization of Input During Web Page Generation

---

## Audit Information

- **Audited By:** Claude Code Security Audit
- **Audit Date:** 2025-11-13
- **Project:** rapport-mcp v1.4.0
- **Location:** /home/kruger/projects/rapport-mcp
- **Files Reviewed:** 8 source files, package.json, tsconfig.json
- **Total Lines Analyzed:** ~1,500+ lines of code
- **Dependencies Checked:** 5 direct, ~150 transitive

---

## Next Steps

1. Read SECURITY_AUDIT.md completely
2. Prioritize fixes based on your schedule
3. Follow SECURITY_FIXES.md for implementation
4. Test thoroughly after each fix
5. Commit changes with clear commit messages
6. Update version number and changelog

All audit documentation is in Markdown format and can be easily shared with your team.
