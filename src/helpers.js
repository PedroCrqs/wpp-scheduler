// anti-ban helpers

const INVISIBLE_CHARS = ["\u200B", "\u200C", "\u200D", "\uFEFF"];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function microVary(text) {
  const char =
    INVISIBLE_CHARS[Math.floor(Math.random() * INVISIBLE_CHARS.length)];
  const pos = Math.floor(Math.random() * (text.length - 1)) + 1;
  return text.slice(0, pos) + char + text.slice(pos);
}
