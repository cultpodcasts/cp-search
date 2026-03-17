export const PostType = {
	SearchBox: "search_box",
	PodcastFocus: "podcast_focus",
	Episode: "episode",
} as const;

export type PostType = (typeof PostType)[keyof typeof PostType];

export const PodcastService = {
	YouTube: "youtube",
	Spotify: "spotify",
	ApplePodcasts: "apple_podcasts",
} as const;

export type PodcastService = (typeof PodcastService)[keyof typeof PodcastService];

export type EpisodeServiceLinks = Partial<Record<PodcastService, string>>;

export type EpisodePostData = {
	title: string;
	description: string;
	releaseDateTime: string;
	duration: string;
	serviceLinks: EpisodeServiceLinks;
};

export type InitResponse = {
	type: "init";
	postType: PostType;
	episode?: EpisodePostData;
};

export type CreateEpisodeApiRequest = EpisodePostData & {
	subredditName?: string;
};

export type CreateEpisodeApiResponse = {
	type: "episode_created";
	postType: typeof PostType.Episode;
	postId: string;
	postUrl: string;
};

export type PostInstance = {
	id: string;
	postId: string;
	postUrl: string;
	postType: PostType;
	title: string;
	createdAt: string;
	createdBy: "menu" | "install" | "api";
	subreddit: string | null;
	podcastName?: string;
	episode?: EpisodePostData;
};
