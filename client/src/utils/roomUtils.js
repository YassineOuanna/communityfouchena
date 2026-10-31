export const DEFAULT_GLOBAL_ROOM = {
  name: "global",
  description: "General community chat",
  isPrivate: false,
};

/**
 * Deduplicates and sanitizes a list of rooms by name (case-insensitive).
 * Guarantees that #global is included once and no two rooms share the same name.
 */
export function deduplicateRooms(roomsList) {
  const map = new Map();

  // Always seed default 'global' room
  map.set("global", { ...DEFAULT_GLOBAL_ROOM });

  if (Array.isArray(roomsList)) {
    for (const r of roomsList) {
      if (!r || !r.name || typeof r.name !== "string") continue;
      const cleanName = r.name.trim();
      const key = cleanName.toLowerCase();
      if (!key) continue;

      const existing = map.get(key);
      map.set(key, {
        ...(existing || {}),
        ...r,
        name: cleanName,
        description:
          r.description && r.description.trim()
            ? r.description.trim()
            : key === "global"
            ? "General community chat"
            : "",
      });
    }
  }

  return Array.from(map.values());
}
