# M365 Error Handling

## Rate Limiting

### Per-Service Throttling Limits

| Service | Limit | Scope |
|---------|-------|-------|
| Microsoft Graph (general) | 10,000 requests / 10 min | Per app + tenant |
| Outlook / Exchange | 10,000 requests / 10 min | Per app + mailbox |
| Teams | 30-60 requests / sec | Per app + team |
| SharePoint | 1,200 requests / min | Per app + tenant |
| OneDrive | 3,000-10,000 / 10 min | Per app + user |

### Handling 429 (Too Many Requests)

When a 429 response is received:
1. Read the `Retry-After` header (value in seconds)
2. Wait for the specified duration
3. Retry the request

### Exponential Backoff Pattern in n8n

```
n8n Node Configuration:
- Retry On Fail: true
- Max Retries: 3
- Wait Between Retries: 1000ms (initial)
- Backoff: Exponential (n8n handles this automatically)

For custom backoff in Code Node:
const delay = Math.pow(2, retryCount) * 1000;  // 1s, 2s, 4s, 8s...
await new Promise(resolve => setTimeout(resolve, delay));
```

### Best Practices
- Use batch requests (`/$batch`) to reduce call count
- Cache frequently accessed data (e.g., team/channel IDs)
- Spread scheduled workflows across time windows (avoid all at :00)
- Use delta queries instead of full reads

---

## Pagination

### @odata.nextLink Pattern

Most Graph API list endpoints return paginated results:

```
Response:
{
  "value": [...items...],
  "@odata.nextLink": "https://graph.microsoft.com/v1.0/...?$skiptoken=..."
}
```

### n8n Pagination Pattern

```
Loop Node Pattern:
1. HTTP Request → GET initial URL
2. Check: Does response have @odata.nextLink?
   ├── YES → Set next URL = @odata.nextLink → Loop back to step 1
   └── NO → Exit loop, merge all results
```

### Tips
- Default page size: 10-100 items (varies by endpoint)
- Use `$top` to control page size: `?$top=999` (max varies by endpoint)
- Some endpoints support `$count=true` for total count
- Never hardcode skip tokens — they are opaque and change

---

## Delta Queries

### Pattern for Incremental Sync

Delta queries return only changes since the last sync:

```
Step 1 (Initial):
GET /users/delta → Returns all users + deltaLink

Step 2 (Store):
Save the deltaLink (URL with delta token)

Step 3 (Incremental):
GET {deltaLink} → Returns only changes + new deltaLink

Step 4:
Repeat Step 2-3 on schedule
```

### Supported Resources
- Users and groups: `/users/delta`, `/groups/delta`
- Messages: `/me/mailFolders/{id}/messages/delta`
- Events: `/me/calendarView/delta`
- Drive items: `/me/drive/root/delta`
- Planner tasks: Not supported (use polling)

### Tips
- Store deltaLink persistently (n8n static data or external DB)
- Delta tokens expire after ~30 days — handle with full re-sync
- Deleted items appear with `@removed` annotation
- Use `$select` to limit fields in delta responses

---

## Webhook Subscription Renewal

### Subscription Lifecycle

```
Create → Active → Expiring → Renewed (or Expired)
```

### Maximum Subscription Duration

| Resource | Max Duration |
|----------|-------------|
| Messages, Events | 4,230 min (~3 days) |
| Drive items | 43,200 min (~30 days) |
| Security alerts | 43,200 min (~30 days) |
| Teams messages | 60 min (short!) |

### Renewal Pattern in n8n

```
Workflow 1 (Main): Processes webhook notifications
Workflow 2 (Maintenance): Scheduled to renew subscriptions

Renewal workflow:
1. Schedule Trigger (before expiration, e.g., daily)
2. GET /subscriptions → List active subscriptions
3. For each: PATCH /subscriptions/{id}
   Body: { "expirationDateTime": "new-future-date" }
4. Log renewal result
```

### Validation Handshake
When creating a subscription, Graph API sends a validation request:
1. Graph sends GET to your notificationUrl with `validationToken` parameter
2. Your webhook must respond with 200 and the validationToken as plain text
3. n8n Webhook nodes handle this automatically when configured correctly

### Tips
- Teams message subscriptions are very short-lived (60 min) — needs frequent renewal
- Use a dedicated maintenance workflow for subscription management
- Store subscription IDs in WORKFLOW_CONTEXT.md or n8n static data
- Handle `subscriptionRemoved` notifications gracefully (re-create subscription)
