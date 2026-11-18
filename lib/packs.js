/** Folder icons. `closed` and `open` are Lucide names. */
export const PACKS = [
  { id: "classic", label: "Classic", closed: "folder-closed", open: "folder-open" },
  { id: "simple", label: "Simple", closed: "folder", open: "folder-open" },
  { id: "stack", label: "Stack", closed: "folders", open: "folder-open" },
  { id: "bookmark", label: "Bookmark", closed: "folder-bookmark", open: "folder-open" },
  { id: "dot", label: "Dot", closed: "folder-dot", open: "folder-open-dot" },
  { id: "heart", label: "Heart", closed: "folder-heart", open: "folder-open" },
  { id: "lock", label: "Lock", closed: "folder-lock", open: "folder-open" },
  { id: "tree", label: "Tree", closed: "folder-tree", open: "folder-open" },
  { id: "code", label: "Code", closed: "folder-code", open: "folder-open" },
  { id: "git", label: "Git", closed: "folder-git", open: "folder-open" },
];

/** @param {string} id */
export function packById(id) {
  return PACKS.find((pack) => pack.id === id) ?? PACKS[0];
}
