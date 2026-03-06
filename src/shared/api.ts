export const InternalEndpoint = {
  OnPostCreate: "/internal/menu/post-create",
  OnAppInstall: "/internal/on-app-install",
} as const;

export type InternalEndpoint =
  (typeof InternalEndpoint)[keyof typeof InternalEndpoint];
