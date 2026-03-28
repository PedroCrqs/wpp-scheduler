const {
  GENERAL_GROUPS,
  SPECIFIC_GROUPS,
  NEIGHBORHOOD_CLASSES,
} = require("./config");

function extractNeighborhood(text) {
  const match = text.match(/_([^_]+)_/);
  return match ? match[1].trim().toLowerCase() : null;
}

function classifyNeighborhood(neighborhood) {
  if (!neighborhood) return "GENERAL";
  const normalized = neighborhood
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  for (const [cls, keywords] of Object.entries(NEIGHBORHOOD_CLASSES)) {
    if (cls === "RECREIO_BARRA") continue;
    for (const keyword of keywords) {
      const keyNorm = keyword
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      if (normalized.includes(keyNorm) || keyNorm.includes(normalized)) {
        return cls;
      }
    }
  }
  return "GENERAL";
}

function resolveGroups(announcementClass) {
  const eligible = SPECIFIC_GROUPS.filter((g) => {
    if (announcementClass === "GENERAL") return false;
    if (g.class === announcementClass) return true;
    if (
      g.class === "RECREIO_BARRA" &&
      (announcementClass === "BARRA" || announcementClass === "RECREIO")
    )
      return true;
    return false;
  }).map((g) => g.id);

  // Deduplica usando Set
  return [...new Set([...GENERAL_GROUPS, ...eligible])];
}

module.exports = { extractNeighborhood, classifyNeighborhood, resolveGroups };
