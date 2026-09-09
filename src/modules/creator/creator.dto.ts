import { CreatorSort } from '../../common/constants/keyboard.constant';

export interface CreatorProfileStatsDto {
  themesCount: number;
  downloadsCount: number;
  followersCount: number;
  likesCount: number;
}

export interface CreatorPublicProfileDto {
  id: string;
  fullName: string | null;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  isCreator: boolean;
  isFeaturedCreator: boolean;
  socialLinks: Record<string, string> | null;
  stats: CreatorProfileStatsDto;
  isFollowing?: boolean;
  joinedAt: Date | string;
}

export interface CreatorListItemDto {
  id: string;
  fullName: string | null;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  isCreator: boolean;
  isFeaturedCreator: boolean;
  stats: CreatorProfileStatsDto;
}

export interface CreatorQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  isFeatured?: boolean;
  sort?: CreatorSort;
}

export interface FollowResultDto {
  creatorId: string;
  username: string;
  isFollowing: boolean;
  followerCount: number;
  message: string;
}

export interface CreatorApplicationItemDto {
  id: string;
  fullName: string | null;
  username: string | null;
  email: string | null;
  bio: string | null;
  avatarUrl: string | null;
  isCreator: boolean;
  creatorStatus: string | null;
  creatorAppliedAt: Date | string | null;
  creatorRejectReason: string | null;
  createdAt: Date | string;
}

export interface CreatorApplicationQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';
}

export interface RejectCreatorApplicationDto {
  reason?: string;
}
