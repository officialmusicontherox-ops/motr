export type Track = {
  id: string;
  title: string;
  artistName: string;
  albumName: string | null;
  artworkUrl: string | null;
  previewUrl: string;
  genre: string | null;
  status: "DISCOVERY" | "VETTING" | "GRADUATED" | "REJECTED";
  requiredFanApprovals: number;
  fanRightSwipes: number;
  fanLeftSwipes: number;
  feeStatus: "NOT_REQUIRED" | "PENDING" | "PAID";
  requiredListenThreshold: number;
  totalListens: number;
  rightSwipes: number;
  leftSwipes: number;
  consecutiveRightSwipes: number;
  approvalRatio: number;
};

export type Fan = {
  id: string;
  username: string;
  displayName?: string | null;
  hasSpotify?: boolean;
};

export type User = {
  id: string;
  email: string;
  username: string;
  curationWeight: number;
  totalSwipes: number;
  rightSwipesOnGraduated: number;
};
