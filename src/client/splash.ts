import { navigateTo } from "@devvit/web/client";

const searchForm = document.getElementById("search-form") as HTMLFormElement;
const queryInput = document.getElementById("query-input") as HTMLInputElement;
const description = document.getElementById("description") as HTMLParagraphElement;
const chipRow = document.getElementById("chip-row") as HTMLDivElement;

type SearchMode = "search" | "subject";

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
