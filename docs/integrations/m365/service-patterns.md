# M365 Service Patterns

## Microsoft Teams

### Channel Messages
```
HTTP Request Node → POST /teams/{team-id}/channels/{channel-id}/messages
Content-Type: application/json
Body: { "body": { "content": "Message text", "contentType": "html" } }
```

### Adaptive Cards
```
HTTP Request Node → POST /teams/{team-id}/channels/{channel-id}/messages
Body: {
  "body": { "contentType": "html", "content": "<attachment id=\"card\"></attachment>" },
  "attachments": [{
    "id": "card",
    "contentType": "application/vnd.microsoft.card.adaptive",
    "content": "{ ... adaptive card JSON ... }"
  }]
}
```

### Meeting Management
- List meetings: `GET /users/{user-id}/onlineMeetings`
- Create meeting: `POST /users/{user-id}/onlineMeetings`
- Get transcript: `GET /users/{user-id}/onlineMeetings/{meeting-id}/transcripts`

### Tips
- Use `$filter` for efficient queries: `?$filter=createdDateTime ge 2024-01-01`
- Channel IDs contain special characters — URL-encode them
- Adaptive Cards have a 28KB size limit

---

## SharePoint Online

### List Operations
```
GET    /sites/{site-id}/lists/{list-id}/items          → Read items
POST   /sites/{site-id}/lists/{list-id}/items          → Create item
PATCH  /sites/{site-id}/lists/{list-id}/items/{item-id} → Update item
DELETE /sites/{site-id}/lists/{list-id}/items/{item-id} → Delete item
```

### Document Operations
```
GET    /sites/{site-id}/drive/root:/{path}:/content     → Download file
PUT    /sites/{site-id}/drive/root:/{path}:/content     → Upload file (< 4MB)
POST   /sites/{site-id}/drive/root:/{path}:/createUploadSession → Large files
```

### Webhooks (Change Notifications)
```
POST /subscriptions
Body: {
  "changeType": "created,updated",
  "notificationUrl": "https://your-n8n/webhook/sharepoint",
  "resource": "sites/{site-id}/lists/{list-id}/items",
  "expirationDateTime": "2024-12-31T00:00:00Z"
}
```

### Search
```
POST /search/query
Body: { "requests": [{ "entityTypes": ["driveItem"], "query": { "queryString": "search term" } }] }
```

### Tips
- Site IDs: Use `GET /sites?search=sitename` to find site IDs
- Large file uploads (> 4MB): Use upload sessions
- List item fields are in `item.fields` object
- Webhook subscriptions expire — renew before expiration

---

## Outlook / Exchange Online

### Mail Processing
```
GET  /me/messages?$filter=isRead eq false             → Unread mail
GET  /me/messages?$filter=from/emailAddress/address eq 'sender@example.com'
POST /me/messages/{id}/move  Body: { "destinationId": "folderId" }
POST /me/sendMail  Body: { "message": { "subject": "...", "body": {...}, "toRecipients": [...] } }
```

### Calendar
```
GET  /me/calendarView?startDateTime=...&endDateTime=...  → Events in range
POST /me/events  Body: { "subject": "...", "start": {...}, "end": {...} }
```

### Contacts
```
GET  /me/contacts                                       → All contacts
GET  /me/contacts?$filter=displayName eq 'Name'        → Filter contacts
```

### Tips
- Use `$select` to limit fields: `?$select=subject,from,receivedDateTime`
- Mail rules: Better handled in Exchange Admin than n8n
- Calendar: Always include timezone in start/end (`"timeZone": "Europe/Berlin"`)
- Batch requests: Up to 20 requests in one call via `POST /$batch`

---

## OneDrive for Business

### File Sync Pattern
```
1. Initial sync:  GET /me/drive/root/delta          → All files + deltaLink
2. Store deltaLink
3. Incremental:   GET {deltaLink}                    → Only changes + new deltaLink
```

### File Operations
```
GET    /me/drive/root:/{path}:/content    → Download
PUT    /me/drive/root:/{path}:/content    → Upload (< 4MB)
POST   /me/drive/root:/{path}:/copy       → Copy
DELETE /me/drive/items/{item-id}           → Delete (to recycle bin)
```

### Sharing
```
POST /me/drive/items/{item-id}/createLink
Body: { "type": "view", "scope": "organization" }
```

### Tips
- Delta queries are the most efficient way to detect changes
- Conflict handling: Use `@microsoft.graph.conflictBehavior` header
- Thumbnails: `GET /me/drive/items/{id}/thumbnails`

---

## Excel Online

### Table Operations
```
GET    /me/drive/items/{id}/workbook/tables/{table}/rows     → Read rows
POST   /me/drive/items/{id}/workbook/tables/{table}/rows/add → Add row
PATCH  /me/drive/items/{id}/workbook/tables/{table}/rows/{index} → Update row
```

### Cell Operations
```
GET   /me/drive/items/{id}/workbook/worksheets/{sheet}/range(address='A1:D10')
PATCH /me/drive/items/{id}/workbook/worksheets/{sheet}/range(address='A1')
Body: { "values": [["value"]] }
```

### Tips
- Always use table names (not cell ranges) for structured data
- Session-based operations: Use `createSession` for multiple writes
- Close sessions after batch operations to avoid locks
- Excel has a 5MB cell content limit

---

## Microsoft Planner

### Task Automation
```
GET    /planner/plans/{plan-id}/tasks                → List tasks
POST   /planner/tasks                                 → Create task
PATCH  /planner/tasks/{task-id}                       → Update task
DELETE /planner/tasks/{task-id}                       → Delete task
```

### Create Task with Details
```
POST /planner/tasks
Body: {
  "planId": "{plan-id}",
  "bucketId": "{bucket-id}",
  "title": "Task title",
  "assignments": { "{user-id}": { "@odata.type": "#microsoft.graph.plannerAssignment", "orderHint": " !" } },
  "dueDateTime": "2024-12-31T00:00:00Z"
}
```

### Tips
- Plan IDs: Use `GET /groups/{group-id}/planner/plans` to find plans
- ETags: Planner requires `If-Match` header with current ETag for updates
- Bucket ordering: Use `orderHint` property
- Task details (description, checklist): Separate endpoint `/planner/tasks/{id}/details`
