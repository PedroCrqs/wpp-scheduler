// anti-ban helpers

const INVISIBLE_CHARS = ["\u200B", "\u200C", "\u200D", "\uFEFF"];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function microVary(text) {
  const char =
    INVISIBLE_CHARS[Math.floor(Math.random() * INVISIBLE_CHARS.length)];
  const pos = Math.floor(Math.random() * (text.length - 1)) + 1;
  return text.slice(0, pos) + char + text.slice(pos);
}
