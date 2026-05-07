# M365 Auth Patterns

## OAuth 2.0 Flows

### Authorization Code Flow (Delegated)
- **Use when:** Workflow acts on behalf of a specific user
- **Examples:** Send mail as user, access user's OneDrive, read user's calendar
- **n8n Credential:** Microsoft OAuth2 API
- **Token:** Access token + Refresh token (auto-renewed by n8n)

### Client Credentials Flow (App-Only)
- **Use when:** Workflow runs without user context (background/scheduled)
- **Examples:** Read all team channels, process all mailboxes, manage SharePoint sites
- **n8n Credential:** Microsoft OAuth2 API (with client credentials grant)
- **Token:** Access token only (requested per execution)

## Decision Tree: Delegated vs App-Only

```
Does the workflow run on behalf of a specific user?
├── YES → Delegated (Authorization Code)
│   ├── User must consent to permissions
│   ├── Token includes user identity
│   └── Scoped to user's access rights
└── NO → App-Only (Client Credentials)
    ├── Admin must grant permissions
    ├── No user context
    └── Access to all resources (within granted permissions)
```

## Common Permission Scopes

### Teams
| Scope | Type | Description |
|-------|------|-------------|
| ChannelMessage.Send | Delegated | Send messages to channels |
| Channel.ReadBasic.All | Delegated/App | Read channel names and descriptions |
| TeamMember.Read.All | Delegated/App | Read team members |
| Chat.ReadWrite | Delegated | Read and send chat messages |

### SharePoint / OneDrive
| Scope | Type | Description |
|-------|------|-------------|
| Sites.Read.All | Delegated/App | Read items in all site collections |
| Sites.ReadWrite.All | Delegated/App | Read and write items |
| Files.ReadWrite.All | Delegated/App | Full access to files |

### Outlook / Exchange
| Scope | Type | Description |
|-------|------|-------------|
| Mail.Read | Delegated/App | Read mail |
| Mail.Send | Delegated/App | Send mail |
| Calendars.ReadWrite | Delegated/App | Read and write calendar events |
| Contacts.Read | Delegated/App | Read contacts |

### Planner
| Scope | Type | Description |
|-------|------|-------------|
| Tasks.ReadWrite | Delegated | Read and write Planner tasks |
| Group.ReadWrite.All | App | Manage Planner plans (via Groups) |

## Token Refresh in n8n

n8n handles token refresh automatically for OAuth2 credentials:
- Access tokens expire after ~60 minutes
- n8n stores the refresh token and requests new access tokens as needed
- If the refresh token expires (90 days inactive), the credential must be re-authorized

### Troubleshooting Token Issues
- **401 Unauthorized:** Token expired and refresh failed → re-authorize credential
- **403 Forbidden:** Missing permissions → check API permissions in App Registration
- **AADSTS700082:** Refresh token expired → re-authorize credential

## Least Privilege Guidelines

1. **Start minimal:** Only request scopes the workflow actually needs
2. **Prefer delegated:** Use app-only only when no user context is available
3. **Avoid .All scopes:** Use specific resource scopes when possible
4. **Review regularly:** Remove unused permissions after workflow changes
5. **Document:** List all scopes in the Credential-Inventar (WORKFLOW_CONTEXT.md)
