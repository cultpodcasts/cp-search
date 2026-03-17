import { PodcastService, PostType, type EpisodePostData, type InitResponse } from "../shared/api.ts";

type EpisodeService = {
  service: PodcastService;
  label: string;
  url: string;
  embedUrl: string | null;
};

const episodeDescription = document.getElementById("episode-description") as HTMLParagraphElement;
const readMore = document.getElementById("read-more") as HTMLButtonElement;
const episodeMeta = document.getElementById("episode-meta") as HTMLParagraphElement;
const episodeImageWrap = document.getElementById("episode-image-wrap") as HTMLDivElement;
const episodeImageBtn = document.getElementById("episode-image-btn") as HTMLButtonElement;
const episodeImage = document.getElementById("episode-image") as HTMLImageElement;
const serviceSwitch = document.getElementById("service-switch") as HTMLDivElement;
const serviceLinks = document.getElementById("service-links") as HTMLDivElement;
const playerWrap = document.getElementById("player-wrap") as HTMLDivElement;
const playerFrame = document.getElementById("episode-player") as HTMLIFrameElement;
const playerNote = document.getElementById("player-note") as HTMLParagraphElement;

void initializeEpisodeMode();

async function initializeEpisodeMode(): Promise<void> {
  try {
    const rsp = await fetch("/api/init");
    if (!rsp.ok) {
      episodeDescription.textContent = "Episode details unavailable.";
      return;
    }

    const init = (await rsp.json()) as InitResponse;
    if (init.postType !== PostType.Episode || !init.episode) {
      episodeDescription.textContent = "This post is not an episode.";
      return;
    }

    renderEpisode(init.episode);
  } catch {
    episodeDescription.textContent = "Episode details unavailable.";
  }
}

function renderEpisode(episode: EpisodePostData): void {
  episodeDescription.textContent = episode.description;
  setupReadMore(episodeDescription, readMore);

  episodeMeta.textContent = formatEpisodeMeta(episode.releaseDateTime, episode.duration);

  const services = collectServices(episode);
  renderServiceLinks(services);

  const hasImage = Boolean(episode.imageUrl?.trim());
  renderServiceSwitcher(services, !hasImage);

  if (hasImage) {
    renderImage(episode.imageUrl!);
  }
}

function setupReadMore(descEl: HTMLParagraphElement, btn: HTMLButtonElement): void {
  void descEl.offsetHeight; // force layout computation
  if (descEl.scrollHeight <= descEl.offsetHeight) {
    return;
  }
  btn.classList.remove("hidden");
  let expanded = false;
  btn.addEventListener("click", () => {
    expanded = !expanded;
    descEl.classList.toggle("clamped", !expanded);
    btn.textContent = expanded ? "Show less" : "Read more";
  });
}

function renderImage(url: string): void {
  episodeImage.src = url;
  episodeImageWrap.classList.remove("hidden");
  episodeImageBtn.addEventListener("click", () => {
    playerWrap.classList.remove("hidden");
    playerWrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

function formatEpisodeMeta(releaseDateTime: string, duration: string): string {
  const parsed = new Date(releaseDateTime);
  const dateText = Number.isNaN(parsed.getTime())
    ? releaseDateTime
    : parsed.toLocaleDateString();
  return `Released: ${dateText} · ${duration}`;
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

function renderServiceSwitcher(services: EpisodeService[], autoShow: boolean): void {
  serviceSwitch.replaceChildren();

  if (services.length === 0) {
    playerNote.textContent = "No service links were provided for this episode.";
    return;
  }

  for (const [index, item] of services.entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "service-button";
    button.textContent = item.label;
    button.addEventListener("click", () => {
      playerWrap.classList.remove("hidden");
      selectService(item, button);
    });

    serviceSwitch.append(button);
    if (index === 0) {
      selectService(item, button);
      if (autoShow) {
        playerWrap.classList.remove("hidden");
      }
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
