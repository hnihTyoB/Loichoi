export const KEYBOARD_PLATFORM = {
  IOS: 'IOS',
  ANDROID: 'ANDROID',
  BOTH: 'BOTH',
} as const;

export type KeyboardPlatform = keyof typeof KEYBOARD_PLATFORM;

export const KEYBOARD_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  HIDDEN: 'HIDDEN',
} as const;

export type KeyboardStatus = keyof typeof KEYBOARD_STATUS;

export const KEYBOARD_SORT = {
  LATEST: 'LATEST',
  POPULAR: 'POPULAR',
  TOP_LIKED: 'TOP_LIKED',
  TOP_DOWNLOADED: 'TOP_DOWNLOADED',
  NAME_ASC: 'NAME_ASC',
  NAME_DESC: 'NAME_DESC',
} as const;

export type KeyboardSort = keyof typeof KEYBOARD_SORT;

export const CREATOR_SORT = {
  TOP_FOLLOWERS: 'TOP_FOLLOWERS',
  TOP_DOWNLOADS: 'TOP_DOWNLOADS',
  TOP_THEMES: 'TOP_THEMES',
  NAME_ASC: 'NAME_ASC',
  NAME_DESC: 'NAME_DESC',
  LATEST: 'LATEST',
} as const;

export type CreatorSort = keyof typeof CREATOR_SORT;

export const THEME_ACCESS_LEVEL = {
  FREE: 'FREE',
  PREMIUM: 'PREMIUM',
  DISCORD_MEMBER: 'DISCORD_MEMBER',
  DISCORD_ROLE: 'DISCORD_ROLE',
} as const;

export type ThemeAccessLevel = keyof typeof THEME_ACCESS_LEVEL;

const DISCORD_DOWNLOAD_HOSTS = new Set([
  'discord.com',
  'www.discord.com',
  'canary.discord.com',
  'ptb.discord.com',
  'discord.gg',
  'cdn.discordapp.com',
  'media.discordapp.net',
]);

export function isGoogleDriveUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname === 'drive.google.com' ||
      hostname === 'docs.google.com'
    );
  } catch {
    return false;
  }
}

export function isDiscordUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === 'https:' && DISCORD_DOWNLOAD_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function isThemeDownloadUrl(urlString: string): boolean {
  return isGoogleDriveUrl(urlString) || isDiscordUrl(urlString);
}
