export const SPONSOR_TIERS = ["utama", "pendukung", "pendamping", "pelengkap"] as const;

export type SponsorTier = (typeof SPONSOR_TIERS)[number];
