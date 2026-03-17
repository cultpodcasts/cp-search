export const PostType = {
	SearchBox: "search_box",
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
	podcastName: string;
	title: string;
	description: string;
	releaseDateTime: string;
	duration: string;
	serviceLinks: EpisodeServiceLinks;
	imageUrl?: string;
};

export type InitResponse = {
	type: "init";
	postType: PostType;
	episode?: EpisodePostData;
};

export type CreateEpisodeApiRequest = EpisodePostData & {
	subredditName?: string;
	flairId?: string;
	flairText?: string;
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
	episode?: EpisodePostData;
};
