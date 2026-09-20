export interface SpeedTier {
  /** Lowest WPM (inclusive) that earns this tier. */
  min: number;
  icon: string;
  title: string;
  message: string;
}

/** Ordered from slowest to fastest. */
export const SPEED_TIERS: SpeedTier[] = [
  {
    min: 0,
    icon: "🐢",
    title: "You are a turtle",
    message: "Slow and steady wins the race. Keep practicing!",
  },
  {
    min: 40,
    icon: "🐇",
    title: "You are a rabbit",
    message: "Around average and getting quicker. Keep hopping!",
  },
  {
    min: 60,
    icon: "🐎",
    title: "You are a horse",
    message: "Solid, professional-level speed. Time to gallop!",
  },
  {
    min: 80,
    icon: "🐆",
    title: "You are a cheetah",
    message: "Seriously fast. Very few typists get this far.",
  },
  {
    min: 100,
    icon: "🦅",
    title: "You are a falcon",
    message: "Triple digits! You are soaring past almost everyone.",
  },
  {
    min: 120,
    icon: "🚀",
    title: "You are a rocket",
    message: "Blistering speed. Elite typist territory.",
  },
  {
    min: 150,
    icon: "⚡",
    title: "You are lightning",
    message: "Legendary. Are you even human?",
  },
];

export function getSpeedTier(wpm: number): SpeedTier {
  let tier = SPEED_TIERS[0];
  for (const candidate of SPEED_TIERS) {
    if (wpm >= candidate.min) tier = candidate;
  }
  return tier;
}
