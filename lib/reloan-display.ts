/**
 * The Reloan page's content, in one place.
 *
 * The store links are configuration, not copy: they differ per environment
 * and neither belongs in a component. Unset means the button is not rendered
 * at all - a dead link to a store is worse than one route to the app.
 */

export type ReloanDisplay = {
  fullName: string | null;
  iosUrl: string | null;
  androidUrl: string | null;
};

export function reloanStoreLinks(): Pick<ReloanDisplay, "iosUrl" | "androidUrl"> {
  return {
    iosUrl: process.env.NEXT_PUBLIC_APP_STORE_URL?.trim() || null,
    androidUrl: process.env.NEXT_PUBLIC_PLAY_STORE_URL?.trim() || null,
  };
}
