function pickRandom(list) {
  if (!Array.isArray(list) || list.length === 0) return "";
  return list[Math.floor(Math.random() * list.length)];
}

const maleSeeds = [
  "anime-boy-kaito",
  "anime-boy-ren",
  "anime-boy-haruto",
  "anime-boy-shin",
  "anime-boy-yuki",
  "anime-boy-riku",
];

const femaleSeeds = [
  "anime-girl-akari",
  "anime-girl-hina",
  "anime-girl-mio",
  "anime-girl-yuna",
  "anime-girl-sora",
  "anime-girl-rin",
];

export function getRandomAnimeAvatar() {
  const isMale = Math.random() < 0.5;
  const seed = pickRandom(isMale ? maleSeeds : femaleSeeds);
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}
