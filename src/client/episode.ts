import { PodcastService, type EpisodePostData } from "../shared/api.ts";

type EpisodeService = {
  service: PodcastService;
  label: string;
  url: string;
  embedUrl: string | null;
};

const description = document.getElementById("description") as HTMLParagraphElement;
const episodeTitle = document.getElementById("episode-title") as HTMLHeadingElement;
const episodeMeta = document.getElementById("episode-meta") as HTMLParagraphElement;
const episodeDescription = document.getElementById("episode-description") as HTMLParagraphElement;
const serviceSwitch = document.getElementById("service-switch") as HTMLDivElement;
const serviceLinks = document.getElementById("service-links") as HTMLDivElement;
const playerFrame = document.getElementById("episode-player") as HTMLIFrameElement;
const playerNote = document.getElementById("player-note") as HTMLParagraphElement;

export function renderEpisode(episode: EpisodePostData): void {
  description.textContent = "Episode spotlight";
  episodeTitle.textContent = episode.title;
  episodeDescription.textContent = episode.description;
  episodeMeta.textContent = formatEpisodeMeta(
    episode.podcastName,
    episode.releaseDateTime,
    episode.duration,
  );

  const services = collectServices(episode);
  renderServiceLinks(services);
  renderServiceSwitcher(services);
}

function formatEpisodeMeta(podcastName: string, releaseDateTime: string, duration: string): string {
  const parsed = new Date(releaseDateTime);
  const dateText = Number.isNaN(parsed.getTime())
    ? releaseDateTime
    : parsed.toLocaleString();
  return `Podcast: ${podcastName} | Released: ${dateText} | Duration: ${duration}`;
}

function collectServices(episode: EpisodePostData): EpisodeService[] {
  const services: EpisodeService[] = [];
  const links = episode.serviceLinks;
  const youtubeUrl = links[PodcastService.YouTube];
  const spotifyUrl = links[PodcastService.Spotify];
  const appleUrl = links[PodcastService.ApplePodcasts];

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
