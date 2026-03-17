import { PostType, type InitResponse } from "../shared/api.ts";
import "./search.ts";
import { renderEpisode } from "./episode.ts";

const searchPanel = document.getElementById("search-panel") as HTMLElement;
const episodePanel = document.getElementById("episode-panel") as HTMLElement;

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

    searchPanel.classList.add("hidden");
    episodePanel.classList.remove("hidden");
    renderEpisode(init.episode);
  } catch {
    // If init API is unavailable we keep the default search mode UI.
  }
}
