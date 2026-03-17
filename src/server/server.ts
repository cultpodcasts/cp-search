import type { IncomingMessage, ServerResponse } from "node:http";
import { context, reddit, redis, settings } from "@devvit/web/server";
import { once } from "node:events";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { PartialJsonValue, TriggerResponse, UiResponse } from "@devvit/web/shared";
import {
  type CreateEpisodeApiRequest,
  type CreateEpisodeApiResponse,
  PodcastService,
  PostType,
  type EpisodePostData,
  type InitResponse,
  type PostInstance,
} from "../shared/api.ts";

const POST_INSTANCE_INDEX_KEY = "post-instance-ids";
const POST_INSTANCE_PREFIX = "post-instance:";
const EPISODE_FORM_NAME = "createEpisodeForm";
const FALLBACK_POST_TITLE_MAX_LENGTH = 300;
const POST_TITLE_MAX_LENGTH_SETTING = "postTitleMaxLength";

type BasePostOptions = {
  subredditName?: string;
  flairId?: string;
  flairText?: string;
};

const ENDPOINT = {
  MenuCreateSearchBox: "/internal/menu/post-create/search-box",
  MenuCreateEpisode: "/internal/menu/post-create/episode",
  FormCreateEpisode: "/internal/form/create-episode-form",
  ApiCreateEpisode: "/api/episode/create",
  ApiInit: "/api/init",
  OnAppInstall: "/internal/on-app-install",
} as const;

const AUTH0_ISSUER_ENV = "AUTH0_ISSUER_BASE_URL";
const AUTH0_AUDIENCE_ENV = "AUTH0_AUDIENCE";
const AUTH0_ROLE_ENV = "AUTH0_REQUIRED_ROLE";
const AUTH0_ROLE_CLAIM_ENV = "AUTH0_ROLE_CLAIM";
const DEFAULT_AUTH0_ROLE_CLAIM = "roles";

const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function serverOnRequest(
  req: IncomingMessage,
  rsp: ServerResponse,
): Promise<void> {
  try {
    await onRequest(req, rsp);
  } catch (err) {
    const msg = `server error; ${err instanceof Error ? err.stack : err}`;
    console.error(msg);
    writeJSON<ErrorResponse>(500, { error: msg, status: 500 }, rsp);
  }
}

async function onRequest(
  req: IncomingMessage,
  rsp: ServerResponse,
): Promise<void> {
  const url = req.url;

  if (!url || url === "/") {
    writeJSON<ErrorResponse>(404, { error: "not found", status: 404 }, rsp);
    return;
  }

  let body: UiResponse | TriggerResponse | CreateEpisodeApiResponse | ErrorResponse;
  switch (url) {
    case ENDPOINT.MenuCreateSearchBox:
      body = await onMenuNewPost();
      break;
    case ENDPOINT.MenuCreateEpisode:
      body = onMenuEpisode();
      break;
    case ENDPOINT.FormCreateEpisode:
      body = await onEpisodeFormSubmit(req);
      break;
    case ENDPOINT.ApiCreateEpisode:
      body = await onApiEpisodeCreate(req);
      break;
    case ENDPOINT.ApiInit:
      body = onApiInit();
      break;
    case ENDPOINT.OnAppInstall:
      body = await onAppInstall();
      break;
    default:
      body = { error: "not found", status: 404 };
      break;
  }

  writeJSON<PartialJsonValue>("status" in body ? body.status : 200, body, rsp);
}

type ErrorResponse = {
  error: string;
  status: number;
};

async function onMenuNewPost(): Promise<UiResponse> {
  const instance = await createPostInstance(PostType.SearchBox, "menu");

  return {
    showToast: {
      text: `Created ${instance.postType} post ${instance.postId}.`,
      appearance: "success",
    },
    navigateTo: instance.postUrl,
  };
}

function onMenuEpisode(): UiResponse {
  return {
    showForm: {
      name: EPISODE_FORM_NAME,
      form: {
        title: "Create Episode Post",
        description: "Create an episode instance with metadata and service links.",
        acceptLabel: "Create Episode",
        fields: [
          {
            type: "string",
            name: "podcastName",
            label: "Podcast Name",
            required: true,
          },
          {
            type: "string",
            name: "episodeTitle",
            label: "Episode Title",
            required: true,
          },
          {
            type: "paragraph",
            name: "episodeDescription",
            label: "Description",
            required: true,
          },
          {
            type: "string",
            name: "releaseDateTime",
            label: "Release Date/Time",
            helpText: "Use ISO format when possible, e.g. 2026-03-17T16:30:00Z",
            required: true,
          },
          {
            type: "string",
            name: "duration",
            label: "Duration",
            helpText: "Example: 1h 12m",
            required: true,
          },
          {
            type: "string",
            name: "youtubeUrl",
            label: "YouTube URL",
          },
          {
            type: "string",
            name: "spotifyUrl",
            label: "Spotify URL",
          },
          {
            type: "string",
            name: "applePodcastsUrl",
            label: "Apple Podcasts URL",
          },
          {
            type: "string",
            name: "imageUrl",
            label: "Image URL",
            helpText: "URL of the episode thumbnail image (optional)",
          },
        ],
      },
    },
  };
}


async function onEpisodeFormSubmit(req: IncomingMessage): Promise<UiResponse> {
  const values = await readFormValues(req);

  const podcastName = readRequiredText(values, "podcastName");
  const episodeTitle = readRequiredText(values, "episodeTitle");
  const episodeDescription = readRequiredText(values, "episodeDescription");
  const releaseDateTime = readRequiredText(values, "releaseDateTime");
  const duration = readRequiredText(values, "duration");

  if (!podcastName || !episodeTitle || !episodeDescription || !releaseDateTime || !duration) {
    return {
      showToast: {
        text: "Podcast name, title, description, release date/time, and duration are required.",
      },
    };
  }

  const serviceLinks: EpisodePostData["serviceLinks"] = {
    [PodcastService.YouTube]: readOptionalText(values, "youtubeUrl"),
    [PodcastService.Spotify]: readOptionalText(values, "spotifyUrl"),
    [PodcastService.ApplePodcasts]: readOptionalText(values, "applePodcastsUrl"),
  };

  if (!hasAtLeastOneServiceLink(serviceLinks)) {
    return {
      showToast: {
        text: "Add at least one service link (YouTube, Spotify, or Apple Podcasts).",
      },
    };
  }

  const imageUrl = readOptionalText(values, "imageUrl");

  const episode: EpisodePostData = {
    podcastName,
    title: episodeTitle,
    description: episodeDescription,
    releaseDateTime,
    duration,
    serviceLinks,
    ...(imageUrl ? { imageUrl } : {}),
  };

  const instance = await createPostInstance(PostType.Episode, "menu", {
    episode,
  });

  return {
    showToast: {
      text: `Created episode post ${instance.postId}.`,
      appearance: "success",
    },
    navigateTo: instance.postUrl,
  };
}

async function onApiEpisodeCreate(
  req: IncomingMessage,
): Promise<CreateEpisodeApiResponse | ErrorResponse> {
  const authResult = await authenticateMachineRequest(req);
  if (!authResult.ok) {
    return {
      error: authResult.message,
      status: authResult.status,
    };
  }

  const payload = await readJsonBody(req);
  const parsed = parseCreateEpisodeApiRequest(payload);
  if (!parsed.ok) {
    return {
      error: parsed.message,
      status: 400,
    };
  }

  const instance = await createPostInstance(PostType.Episode, "api", {
    episode: parsed.request,
    subredditName: parsed.request.subredditName,
    flairId: parsed.request.flairId,
    flairText: parsed.request.flairText,
  });

  return {
    type: "episode_created",
    postType: PostType.Episode,
    postId: instance.postId,
    postUrl: instance.postUrl,
  };
}

async function onAppInstall(): Promise<TriggerResponse> {
  await createPostInstance(PostType.SearchBox, "install");

  return {};
}

function onApiInit(): InitResponse {
  const postData = context.postData;
  if (!isRecord(postData)) {
    return { type: "init", postType: PostType.SearchBox };
  }

  const postType = readPostType(postData.postType);
  if (postType !== PostType.Episode) {
    return { type: "init", postType };
  }

  const episode = readEpisodeFromPostData(postData.episode);
  return {
    type: "init",
    postType,
    ...(episode ? { episode } : {}),
  };
}

async function createPostInstance(
  postType: typeof PostType.SearchBox,
  createdBy: PostInstance["createdBy"],
  options?: BasePostOptions,
): Promise<PostInstance>;
async function createPostInstance(
  postType: typeof PostType.Episode,
  createdBy: PostInstance["createdBy"],
  options: BasePostOptions & { episode: EpisodePostData },
): Promise<PostInstance>;
async function createPostInstance(
  postType: PostType,
  createdBy: PostInstance["createdBy"],
  options?: BasePostOptions & { episode?: EpisodePostData },
): Promise<PostInstance> {
  const title = await getPostTitle(postType, options);
  const entry = getEntryForPostType(postType);
  const post = await reddit.submitCustomPost({
    ...(options?.subredditName ? { subredditName: options.subredditName } : {}),
    entry,
    title,
    postData: buildPostData(postType, options),
    ...(options?.flairId ? { flairId: options.flairId } : {}),
    ...(options?.flairText ? { flairText: options.flairText } : {}),
  });

  const instance: PostInstance = {
    id: post.id,
    postId: post.id,
    postUrl: post.url,
    postType,
    title,
    createdAt: new Date().toISOString(),
    createdBy,
    subreddit: context.subredditName ?? null,
    episode: options?.episode,
  };

  await redis.set(`${POST_INSTANCE_PREFIX}${instance.postId}`, JSON.stringify(instance));
  await appendInstanceId(instance.postId);
  return instance;
}

function getEntryForPostType(postType: PostType): "search" | "episode" {
  switch (postType) {
    case PostType.SearchBox:
      return "search";
    case PostType.Episode:
      return "episode";
    default:
      postType satisfies never;
      return "search";
  }
}

async function getPostTitle(
  postType: PostType,
  options?: BasePostOptions & { episode?: EpisodePostData },
): Promise<string> {
  switch (postType) {
    case PostType.SearchBox:
      return "CultPodcasts Search Box";
    case PostType.Episode: {
      const ep = options?.episode;
      if (!ep) {
        throw new Error("EpisodePostData is required when creating an episode post.");
      }
      const maxLen =
        (await settings.get<number>(POST_TITLE_MAX_LENGTH_SETTING)) ??
        FALLBACK_POST_TITLE_MAX_LENGTH;
      return buildEpisodePostTitle(ep.title, ep.podcastName, maxLen);
    }
    default:
      postType satisfies never;
      return context.appName ?? "CultPodcasts Research Companion";
  }
}

function buildEpisodePostTitle(episodeTitle: string, podcastName: string, maxLen: number): string {
  const separator = " – ";
  const suffix = `${separator}${podcastName}`;
  const budget = maxLen - suffix.length;
  if (budget <= 0) return episodeTitle.slice(0, maxLen);
  const truncated =
    episodeTitle.length > budget
      ? `${episodeTitle.slice(0, budget - 1)}…`
      : episodeTitle;
  return `${truncated}${suffix}`;
}

function buildPostData(
  postType: PostType,
  options?: BasePostOptions & { episode?: EpisodePostData },
): {
  postType: PostType;
  episode?: EpisodePostData;
} {
  switch (postType) {
    case PostType.SearchBox:
      return { postType };
    case PostType.Episode:
      if (!options?.episode) {
        throw new Error("EpisodePostData is required when creating an episode post.");
      }
      return {
        postType,
        episode: options.episode,
      };
    default:
      postType satisfies never;
      return { postType: PostType.SearchBox };
  }
}

async function readFormValues(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Uint8Array[] = [];
  req.on("data", (chunk) => chunks.push(chunk));
  await once(req, "end");

  if (chunks.length === 0) {
    return {};
  }

  const body = Buffer.concat(chunks).toString("utf8").trim();
  if (!body) {
    return {};
  }

  try {
    const parsed = JSON.parse(body) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    const params = new URLSearchParams(body);
    const obj: Record<string, unknown> = {};
    for (const [key, value] of params.entries()) {
      obj[key] = value;
    }
    return obj;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredText(values: Record<string, unknown>, key: string): string {
  const value = values[key];
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalText(values: Record<string, unknown>, key: string): string | undefined {
  const value = readRequiredText(values, key);
  return value.length > 0 ? value : undefined;
}

function hasAtLeastOneServiceLink(links: EpisodePostData["serviceLinks"]): boolean {
  return Boolean(
    links[PodcastService.YouTube] ||
      links[PodcastService.Spotify] ||
      links[PodcastService.ApplePodcasts],
  );
}

function readPostType(value: unknown): PostType {
  return value === PostType.Episode
    ? value
    : PostType.SearchBox;
}

function readEpisodeFromPostData(value: unknown): EpisodePostData | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const podcastName = typeof value.podcastName === "string" ? value.podcastName.trim() : "";
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const description = typeof value.description === "string" ? value.description.trim() : "";
  const releaseDateTime =
    typeof value.releaseDateTime === "string" ? value.releaseDateTime.trim() : "";
  const duration = typeof value.duration === "string" ? value.duration.trim() : "";

  if (!podcastName || !title || !description || !releaseDateTime || !duration) {
    return undefined;
  }

  const linksRaw = isRecord(value.serviceLinks) ? value.serviceLinks : {};
  const serviceLinks: EpisodePostData["serviceLinks"] = {
    [PodcastService.YouTube]: asOptionalString(linksRaw[PodcastService.YouTube]),
    [PodcastService.Spotify]: asOptionalString(linksRaw[PodcastService.Spotify]),
    [PodcastService.ApplePodcasts]: asOptionalString(linksRaw[PodcastService.ApplePodcasts]),
  };

  if (!hasAtLeastOneServiceLink(serviceLinks)) {
    return undefined;
  }

  const imageUrl = asOptionalString(value.imageUrl);

  return {
    podcastName,
    title,
    description,
    releaseDateTime,
    duration,
    serviceLinks,
    ...(imageUrl ? { imageUrl } : {}),
  };
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

async function authenticateMachineRequest(
  req: IncomingMessage,
): Promise<{ ok: true; payload: JWTPayload } | { ok: false; status: number; message: string }> {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.toLowerCase().startsWith("bearer ")) {
    return { ok: false, status: 401, message: "missing bearer token" };
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    return { ok: false, status: 401, message: "missing bearer token" };
  }

  const issuerConfig = getRequiredEnv(AUTH0_ISSUER_ENV);
  const audience = getRequiredEnv(AUTH0_AUDIENCE_ENV);
  if (!issuerConfig || !audience) {
    return {
      ok: false,
      status: 503,
      message: `${AUTH0_ISSUER_ENV} and ${AUTH0_AUDIENCE_ENV} must be configured`,
    };
  }

  const issuer = normalizeIssuer(issuerConfig);
  const jwks = getRemoteJwks(issuer);

  try {
    const verified = await jwtVerify(token, jwks, {
      issuer,
      audience,
    });

    const requiredRole = getRequiredEnv(AUTH0_ROLE_ENV);
    if (!requiredRole) {
      return {
        ok: false,
        status: 503,
        message: `${AUTH0_ROLE_ENV} must be configured`,
      };
    }

    const roleClaim = process.env[AUTH0_ROLE_CLAIM_ENV] || DEFAULT_AUTH0_ROLE_CLAIM;
    if (!hasRole(verified.payload, requiredRole, roleClaim)) {
      return {
        ok: false,
        status: 403,
        message: `token missing required role: ${requiredRole}`,
      };
    }

    return {
      ok: true,
      payload: verified.payload,
    };
  } catch {
    return {
      ok: false,
      status: 401,
      message: "invalid access token",
    };
  }
}

function normalizeIssuer(issuer: string): string {
  return issuer.endsWith("/") ? issuer : `${issuer}/`;
}

function getRemoteJwks(issuer: string): ReturnType<typeof createRemoteJWKSet> {
  const cached = jwksByIssuer.get(issuer);
  if (cached) {
    return cached;
  }

  const jwksUri = new URL(".well-known/jwks.json", issuer);
  const remote = createRemoteJWKSet(jwksUri);
  jwksByIssuer.set(issuer, remote);
  return remote;
}

function getRequiredEnv(key: string): string | null {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : null;
}

function hasRole(payload: JWTPayload, requiredRole: string, roleClaim: string): boolean {
  if (!requiredRole) {
    return true;
  }

  const claimValue = payload[roleClaim];
  if (Array.isArray(claimValue)) {
    return claimValue.some((role) => typeof role === "string" && role === requiredRole);
  }

  if (typeof claimValue === "string") {
    // Some tokens encode roles as a space-delimited string.
    const roles = claimValue.split(" ").map((role) => role.trim()).filter(Boolean);
    if (roles.includes(requiredRole)) {
      return true;
    }
  }

  const fallbackRoles = payload.roles;
  if (Array.isArray(fallbackRoles)) {
    return fallbackRoles.some((role) => typeof role === "string" && role === requiredRole);
  }

  if (typeof fallbackRoles === "string") {
    const roles = fallbackRoles.split(" ").map((role) => role.trim()).filter(Boolean);
    if (roles.includes(requiredRole)) {
      return true;
    }
  }

  const permissionsClaim = payload.permissions;
  if (Array.isArray(permissionsClaim)) {
    // Backward-compatible fallback: some Auth0 setups emit roles in permissions.
    return permissionsClaim.some((permission) => permission === requiredRole);
  }

  if (typeof permissionsClaim === "string") {
    const permissions = permissionsClaim.split(" ").map((permission) => permission.trim()).filter(Boolean);
    if (permissions.includes(requiredRole)) {
      return true;
    }
  }

  return false;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  req.on("data", (chunk) => chunks.push(chunk));
  await once(req, "end");

  if (chunks.length === 0) {
    return {};
  }

  const body = Buffer.concat(chunks).toString("utf8").trim();
  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return {};
  }
}

function parseCreateEpisodeApiRequest(
  payload: unknown,
):
  | { ok: true; request: CreateEpisodeApiRequest }
  | { ok: false; message: string } {
  if (!isRecord(payload)) {
    return { ok: false, message: "request body must be a JSON object" };
  }

  const podcastName = asRequiredString(payload.podcastName);
  const title = asRequiredString(payload.title);
  const description = asRequiredString(payload.description);
  const releaseDateTime = asRequiredString(payload.releaseDateTime);
  const duration = asRequiredString(payload.duration);

  if (!podcastName || !title || !description || !releaseDateTime || !duration) {
    return {
      ok: false,
      message: "podcastName, title, description, releaseDateTime, and duration are required",
    };
  }

  const serviceLinks = parseEpisodeServiceLinks(payload.serviceLinks);
  if (!hasAtLeastOneServiceLink(serviceLinks)) {
    return {
      ok: false,
      message: "serviceLinks must include at least one of youtube, spotify, or apple_podcasts",
    };
  }

  const subredditName = asOptionalString(payload.subredditName);
  const flairId = asOptionalString(payload.flairId);
  const flairText = asOptionalString(payload.flairText);
  const imageUrl = asOptionalString(payload.imageUrl);

  return {
    ok: true,
    request: {
      podcastName,
      title,
      description,
      releaseDateTime,
      duration,
      serviceLinks,
      ...(subredditName ? { subredditName } : {}),
      ...(flairId ? { flairId } : {}),
      ...(flairText ? { flairText } : {}),
      ...(imageUrl ? { imageUrl } : {}),
    },
  };
}

function parseEpisodeServiceLinks(rawValue: unknown): EpisodePostData["serviceLinks"] {
  if (!isRecord(rawValue)) {
    return {};
  }

  return {
    [PodcastService.YouTube]: asOptionalString(rawValue[PodcastService.YouTube]),
    [PodcastService.Spotify]: asOptionalString(rawValue[PodcastService.Spotify]),
    [PodcastService.ApplePodcasts]: asOptionalString(rawValue[PodcastService.ApplePodcasts]),
  };
}

function asRequiredString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function appendInstanceId(postId: string): Promise<void> {
  const raw = await redis.get(POST_INSTANCE_INDEX_KEY);
  const ids = parseStoredIds(raw);

  if (!ids.includes(postId)) {
    ids.push(postId);
  }

  await redis.set(POST_INSTANCE_INDEX_KEY, JSON.stringify(ids));
}

function parseStoredIds(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function writeJSON<T extends PartialJsonValue>(
  status: number,
  json: Readonly<T>,
  rsp: ServerResponse,
): void {
  const body = JSON.stringify(json);
  const len = Buffer.byteLength(body);
  rsp.writeHead(status, {
    "Content-Length": len,
    "Content-Type": "application/json",
  });
  rsp.end(body);
}
