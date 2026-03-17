import { navigateTo } from "@devvit/web/client";
import {
  PodcastService,
  PostType,
  type EpisodePostData,
  type InitResponse,
} from "../shared/api.ts";

const searchForm = document.getElementById("search-form") as HTMLFormElement;
const queryInput = document.getElementById("query-input") as HTMLInputElement;
const description = document.getElementById("description") as HTMLParagraphElement;
const chipRow = document.getElementById("chip-row") as HTMLDivElement;
const episodePanel = document.getElementById("episode-panel") as HTMLElement;
const episodeTitle = document.getElementById("episode-title") as HTMLHeadingElement;
const episodeMeta = document.getElementById("episode-meta") as HTMLParagraphElement;
const episodeDescription = document.getElementById("episode-description") as HTMLParagraphElement;
const serviceSwitch = document.getElementById("service-switch") as HTMLDivElement;
const serviceLinks = document.getElementById("service-links") as HTMLDivElement;
const playerFrame = document.getElementById("episode-player") as HTMLIFrameElement;
const playerNote = document.getElementById("player-note") as HTMLParagraphElement;
const quickTopicsPanel = document.querySelector("section.panel[aria-label='Quick topics']") as HTMLElement;

type SearchMode = "search" | "subject";
type EpisodeService = {
  service: PodcastService;
  label: string;
  url: string;
  embedUrl: string | null;
};

function getSearchUrl(query: string, mode: SearchMode): string {
  const encodedQuery = encodeURIComponent(query.trim());
  return mode === "subject"
    ? `https://cultpodcasts.com/subject/${encodedQuery}`
    : `https://cultpodcasts.com/search/${encodedQuery}`;
}

function openSearch(query: string, mode: SearchMode): void {
  const searchUrl = getSearchUrl(query, mode);

  // Some embedded webviews throw on window.open rather than returning null.
  try {
    const opened = window.open(searchUrl, "_blank");
    if (opened) {
      return;
    }
  } catch {
    // Ignore and fall back to navigateTo below.
  }

  navigateTo(searchUrl);
}

function runSearch(query: string, mode: SearchMode): void {
  description.textContent = "Opening cultpodcasts.com in a new tab...";
  openSearch(query, mode);
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = queryInput.value.trim();

  if (!query) {
    description.textContent = "Type something first, then press Search.";
    return;
  }

  runSearch(query, "search");
});

chipRow.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const button = target.closest<HTMLButtonElement>("button[data-query]");
  if (!button) {
    return;
  }
  const query = button.dataset.query?.trim();
  if (!query) {
    return;
  }
  queryInput.value = query;
  runSearch(query, "subject");
});

void initializePostMode();

async function initializePostMode(): Promise<void> {
  try {
    const rsp = await fetch("/api/init");
    if (!rsp.ok) {
      return;
    }

    const init = (await rsp.json()) as InitResponse;
    if (init.postType !== PostType.Episode || !init.episode) {
      return;
    }

    renderEpisode(init.episode);
  } catch {
    // If init API is unavailable we keep the default search mode UI.
  }
}

function renderEpisode(episode: EpisodePostData): void {
  searchForm.classList.add("hidden");
  quickTopicsPanel.classList.add("hidden");
  episodePanel.classList.remove("hidden");

  description.textContent = "Episode spotlight";
  episodeTitle.textContent = episode.title;
  episodeDescription.textContent = episode.description;
  episodeMeta.textContent = formatEpisodeMeta(episode.releaseDateTime, episode.duration);

  const services = collectServices(episode);
  renderServiceLinks(services);
  renderServiceSwitcher(services);
}

function formatEpisodeMeta(releaseDateTime: string, duration: string): string {
  const parsed = new Date(releaseDateTime);
  const dateText = Number.isNaN(parsed.getTime())
    ? releaseDateTime
    : parsed.toLocaleString();
  return `Released: ${dateText} | Duration: ${duration}`;
}

function collectServices(episode: EpisodePostData): EpisodeService[] {
  const services: EpisodeService[] = [];
  const serviceLinks = episode.serviceLinks;
  const youtubeUrl = serviceLinks[PodcastService.YouTube];
  const spotifyUrl = serviceLinks[PodcastService.Spotify];
  const appleUrl = serviceLinks[PodcastService.ApplePodcasts];

  if (typeof youtubeUrl === "string" && youtubeUrl.trim()) {
    services.push({
      service: PodcastService.YouTube,
      label: "YouTube",
      url: youtubeUrl,
      embedUrl: toYouTubeEmbedUrl(youtubeUrl),
    });
  }

  if (typeof spotifyUrl === "string" && spotifyUrl.trim()) {
    services.push({
      service: PodcastService.Spotify,
      label: "Spotify",
      url: spotifyUrl,
      embedUrl: toSpotifyEmbedUrl(spotifyUrl),
    });
  }

  if (typeof appleUrl === "string" && appleUrl.trim()) {
    services.push({
      service: PodcastService.ApplePodcasts,
      label: "Apple Podcasts",
      url: appleUrl,
      embedUrl: toAppleEmbedUrl(appleUrl),
    });
  }

  return services;
}

function renderServiceLinks(services: EpisodeService[]): void {
  serviceLinks.replaceChildren();

  for (const item of services) {
    const link = document.createElement("a");
    link.className = "service-link";
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noreferrer noopener";
    link.textContent = `Open in ${item.label}`;
    serviceLinks.append(link);
  }
}

function renderServiceSwitcher(services: EpisodeService[]): void {
  serviceSwitch.replaceChildren();

  if (services.length === 0) {
    playerFrame.classList.add("hidden");
    playerNote.textContent = "No service links were provided for this episode.";
    return;
  }

  playerFrame.classList.remove("hidden");

  for (const [index, item] of services.entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "service-button";
    button.textContent = item.label;
    button.addEventListener("click", () => {
      selectService(item, button);
    });

    serviceSwitch.append(button);
    if (index === 0) {
      selectService(item, button);
    }
  }
}

function selectService(item: EpisodeService, activeButton: HTMLButtonElement): void {
  serviceSwitch.querySelectorAll(".service-button").forEach((node) => {
    node.classList.remove("active");
  });
  activeButton.classList.add("active");

  if (item.embedUrl) {
    playerFrame.src = item.embedUrl;
    playerNote.textContent = "Switch services to change the embedded player.";
    return;
  }

  playerFrame.src = "about:blank";
  playerNote.textContent = `Embedded playback unavailable for ${item.label}; use the link below.`;
}

function toYouTubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace("/", "").trim();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      if (id) {
        return `https://www.youtube.com/embed/${id}`;
      }

      if (parsed.pathname.startsWith("/embed/")) {
        return parsed.toString();
      }
    }
  } catch {
    return null;
  }

  return null;
}

function toSpotifyEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("spotify.com")) {
      return null;
    }

    if (parsed.pathname.startsWith("/embed/")) {
      return parsed.toString();
    }

    return `https://open.spotify.com/embed${parsed.pathname}`;
  } catch {
    return null;
  }
}

function toAppleEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.startsWith("embed.podcasts.apple.com")) {
      return parsed.toString();
    }

    if (parsed.hostname.startsWith("podcasts.apple.com")) {
      return `https://embed.podcasts.apple.com${parsed.pathname}${parsed.search}`;
    }
  } catch {
    return null;
  }

  return null;
}
