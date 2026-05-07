# M365 Reference Architectures

Five text-based reference architectures for common Microsoft 365 integration patterns.

---

## 1. Email-to-Task Pipeline

**Use case:** Incoming emails from a specific sender/subject → Planner tasks → Teams notification

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  Schedule    │────→│  Outlook     │────→│  Filter &   │────→│  Planner     │
│  Trigger     │     │  GET unread  │     │  Extract    │     │  Create Task │
│  (every 5m)  │     │  messages    │     │  Data       │     │              │
└─────────────┘     └──────────────┘     └─────────────┘     └──────┬───────┘
                                                                     │
                    ┌──────────────┐     ┌─────────────┐            │
                    │  Outlook     │←────│  Teams      │←───────────┘
                    │  Mark read   │     │  Post Card  │
                    └──────────────┘     └─────────────┘

Nodes: 6
Auth: Delegated (user mailbox) or App-Only (shared mailbox)
Credentials: Microsoft OAuth2
Error: Error Trigger → Teams notification to admin channel
```

### Key Decisions
- Delegated if processing one user's mailbox
- App-Only if processing shared/service mailbox
- Use `$filter` to limit API calls (sender, subject, date)
- Mark emails as read after processing to avoid duplicates

---

## 2. Document Approval Workflow

**Use case:** New document in SharePoint → Teams Adaptive Card for approval → Update metadata

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Webhook     │────→│  SharePoint  │────→│  Build      │
│  (SP change  │     │  GET item    │     │  Adaptive   │
│  notification)│    │  details     │     │  Card       │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                  │
┌─────────────┐     ┌──────────────┐     ┌───────┴──────┐
│  SharePoint  │←────│  Process    │←────│  Teams       │
│  Update item │     │  Response   │     │  Post Card   │
│  metadata    │     │  (approve/  │     │  & Wait for  │
│              │     │   reject)   │     │  response    │
└─────────────┘     └──────────────┘     └──────────────┘

Nodes: 6
Auth: App-Only (background process)
Credentials: Microsoft OAuth2
Webhook: SharePoint change notification subscription
Error: Error Trigger → Email to document owner
```

### Key Decisions
- Webhook subscription must be renewed (see error-handling.md)
- Adaptive Card with Action.Submit for approve/reject buttons
- Store approval decision in SharePoint list column
- Consider timeout: What if nobody responds?

---

## 3. Reporting Pipeline

**Use case:** Read Excel data → Aggregate/Transform → Send report via Email + Teams

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  Schedule    │────→│  Excel       │────→│  Code Node  │────→│  Split:      │
│  Trigger     │     │  GET table   │     │  Aggregate  │     │  Email +     │
│  (weekly)    │     │  rows        │     │  & Format   │     │  Teams       │
└─────────────┘     └──────────────┘     └─────────────┘     └──────┬───────┘
                                                                     │
                                          ┌─────────────┐     ┌─────┴────────┐
                                          │  Teams       │     │  Outlook     │
                                          │  Post        │     │  Send Mail   │
                                          │  Summary     │     │  with Report │
                                          └─────────────┘     └──────────────┘

Nodes: 6
Auth: Delegated (send as user) or App-Only (send as service)
Credentials: Microsoft OAuth2
Error: Error Trigger → Email to report owner
```

### Key Decisions
- Excel session management: Create session for reads, close after
- Code Node for aggregation (JavaScript or Python)
- HTML formatting for email body
- Teams message as summary, email as detailed report

---

## 4. User Onboarding Automation

**Use case:** HR event (new employee) → Create Entra ID user → Add to Teams → Create SharePoint folder

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  Webhook     │────→│  Validate    │────→│  Entra ID   │────→│  Assign      │
│  (HR system  │     │  Employee    │     │  Create     │     │  Licenses    │
│  or manual)  │     │  Data        │     │  User       │     │              │
└─────────────┘     └──────────────┘     └─────────────┘     └──────┬───────┘
                                                                     │
┌─────────────┐     ┌──────────────┐     ┌─────────────┐           │
│  Teams       │←────│  SharePoint  │←────│  Teams      │←──────────┘
│  Welcome     │     │  Create      │     │  Add to     │
│  Message     │     │  User Folder │     │  Team       │
└─────────────┘     └──────────────┘     └─────────────┘

Nodes: 7
Auth: App-Only (admin operations)
Credentials: Microsoft OAuth2 (with admin consent)
Scopes: User.ReadWrite.All, Group.ReadWrite.All, Sites.ReadWrite.All
Error: Error Trigger → Email to IT admin with failed step
```

### Key Decisions
- App-Only is required (admin operations, no user context)
- Admin consent needed for User.ReadWrite.All
- Sequential execution (each step depends on previous)
- Error handling per step (partial onboarding is worse than none)
- Consider idempotency: What if webhook fires twice?

---

## 5. Meeting Summary Pipeline

**Use case:** Teams meeting ends → Get transcript → AI summarization → Save to SharePoint

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  Schedule    │────→│  Teams       │────→│  Teams      │────→│  AI Node     │
│  Trigger     │     │  List recent │     │  GET        │     │  Summarize   │
│  (hourly)    │     │  meetings    │     │  Transcript │     │  Transcript  │
└─────────────┘     └──────────────┘     └─────────────┘     └──────┬───────┘
                                                                     │
                    ┌──────────────┐     ┌─────────────┐            │
                    │  Teams       │←────│  SharePoint  │←───────────┘
                    │  Post        │     │  Upload      │
                    │  Summary     │     │  Summary Doc │
                    └──────────────┘     └─────────────┘

Nodes: 6
Auth: Delegated (user meetings) or App-Only (all meetings)
Credentials: Microsoft OAuth2 + AI Service credential
Scopes: OnlineMeetings.Read, OnlineMeetingTranscript.Read.All
Error: Error Trigger → Log failed meetings for manual review
```

### Key Decisions
- Transcript availability: Not immediate after meeting ends (~15-30 min delay)
- Polling vs webhook for meeting end detection
- AI summarization: n8n AI Agent node or external API
- SharePoint folder structure: By date, by team, or by organizer?
- PII consideration: Transcripts contain names and spoken content
