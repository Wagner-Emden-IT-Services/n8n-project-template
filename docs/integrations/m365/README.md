# Microsoft 365 Integration Module

## Overview

This optional module provides patterns, auth strategies, and reference architectures for n8n workflows that integrate with Microsoft 365 services via the Microsoft Graph API.

## When to Use

Load this module when your workflow integrates with:
- Microsoft Teams (messages, channels, adaptive cards)
- SharePoint Online (lists, documents, webhooks)
- Outlook / Exchange Online (mail, calendar, contacts)
- OneDrive for Business (files, sync, sharing)
- Excel Online (tables, reports)
- Microsoft Planner (tasks, plans, buckets)

## Activation

This module is **opt-in**. There is no auto-trigger — Claude Code does not load it
unless explicitly referenced. Two practical ways to bring it in:

1. **As a Sub-Agent reference:** When `n8n-integration-architect` runs, it
   instructs the agent to load files from `docs/integrations/m365/` if the
   workflow involves M365 services.
2. **Direct human read:** Open the relevant `.md` files when designing or
   reviewing M365-bound workflows.

## Prerequisites

### Azure AD / Entra ID App Registration

1. Go to [Entra ID Portal](https://entra.microsoft.com) → App registrations → New registration
2. Name: `n8n-workflow-integration` (or project-specific name)
3. Redirect URI: `https://your-n8n-instance.com/rest/oauth2-credential/callback`
4. Note the **Application (client) ID** and **Directory (tenant) ID**
5. Create a **Client Secret** (Certificates & secrets → New client secret)
6. Configure **API Permissions** (see auth-patterns.md for guidance)

### n8n Credential Setup

1. In n8n: Credentials → New → Microsoft OAuth2 API
2. Enter Client ID, Client Secret, Tenant ID
3. Set scope based on required services (see auth-patterns.md)
4. Click "Connect" to complete OAuth flow

## Module Files

| File | Content |
|------|---------|
| `auth-patterns.md` | OAuth flows, delegated vs app-only, token refresh, scopes |
| `service-patterns.md` | Patterns for Teams, SharePoint, Outlook, OneDrive, Excel, Planner |
| `error-handling.md` | Rate limiting, pagination, delta queries, webhook renewal |
| `architectures.md` | 5 reference architecture diagrams (text-based) |

## Integration with Sub-Agents

- **`n8n-integration-architect`**: Loads `auth-patterns.md` + `service-patterns.md` when designing M365 workflows
- **`n8n-security-reviewer`**: References `auth-patterns.md` for permission scope validation
- **`n8n-workflow-developer`**: Uses `service-patterns.md` for Graph API HTTP node configuration

## Related

- Spec-System: `docs/specs/` — track M365-Workflows als WF-X-Specs
- Disaster Recovery: `docs/disaster-recovery.md` — Encryption-Key-Loss Szenario gilt auch fuer M365-OAuth-Credentials
