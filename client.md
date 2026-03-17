# Episode Post API — Client Reference

## Endpoint

```
POST /api/episode/create
Content-Type: application/json
Authorization: Bearer <token>
```

## Authentication

Requests must include an Auth0 Bearer JWT in the `Authorization` header.

**Required role:** role configured in `AUTH0_REQUIRED_ROLE`.
By default, roles are read from the `roles` claim. Override with `AUTH0_ROLE_CLAIM`.

**Required env vars on the server:**
- `AUTH0_ISSUER_BASE_URL` — Auth0 tenant base URL
- `AUTH0_AUDIENCE` — expected audience claim
- `AUTH0_REQUIRED_ROLE` — required role value that must be present in token claims
- `AUTH0_ROLE_CLAIM` _(optional)_ — claim key that contains roles; defaults to `roles`

## Request Body

```ts
{
  podcastName: string;        // required
  title: string;              // required
  description: string;        // required — see size constraint below
  releaseDateTime: string;    // required — ISO 8601 preferred, e.g. "2026-03-17T16:30:00Z"
  duration: string;           // required — free text, e.g. "1h 12m"
  subredditName?: string;     // optional — defaults to app's configured subreddit
  flairId?: string;           // optional — flair template UUID from subreddit flair settings
  flairText?: string;         // optional — flair text (used alone or to override a template's text)
  imageUrl?: string;          // optional — URL of the episode thumbnail image; displayed with a play overlay, clicking it reveals the embedded player

  serviceLinks: {             // required — at least one must be present
    youtube?: string;
    spotify?: string;
    apple_podcasts?: string;
  };
}
```

## Response Body

```ts
{
  type: "episode_created";
  postType: "episode";
  postId: string;   // Reddit post ID (t3_xxxx)
  postUrl: string;  // Full URL to the created post
}
```

## Error Responses

| Status | Meaning |
|--------|---------|
| 400 | Request body failed validation |
| 401 | Missing or malformed Bearer token |
| 403 | Token lacks the required role |
| 500 | Post creation failed (e.g. payload too large — see below) |

## ⚠️ postData size constraint

Devvit enforces a hard **2000-byte limit** on the `postData` object stored with each custom post. All episode fields (podcastName, title, description, releaseDateTime, duration, serviceLinks) are serialised into `postData` at post-creation time and must fit within this budget.

The JSON envelope itself consumes roughly 175 bytes of fixed overhead, leaving approximately **1825 bytes for field values**. Service link URLs typically consume 100–250 bytes combined, leaving roughly **1500–1700 bytes for the remaining text fields**.

**Practical guidance:**
- Keep `description` under **300 characters** to leave comfortable headroom for all other fields.
- `title` and `podcastName` together should stay under **200 characters**.
- Exceeding the limit returns HTTP 500 with the server error: `custom post data size N exceeds the limit of 2000 bytes`.

If a description is longer than safe limits, truncate it before calling this endpoint (e.g. truncate to 300 chars, appending `…` if cut).
