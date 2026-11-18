import { PACKS, packById } from "./packs.js";

/** The stylesheet a new install starts from. Nothing in it changes the theme. */
export const DEFAULT_CSS = `/* Theme enhancer
   This file overrides the active theme. Edit it here or in the plugin
   settings. Delete a line to use the theme's own value again.

   Icon pack: ${PACKS.map((pack) => pack.id).join(", ")}
   Icon colors are #hex. Leave one out to keep the theme's color.

   .theme uses the color names from a theme.json "colors" block.
   .highlight uses the names from a theme.json "highlight" block.
   .folder sets the icon of one folder, by its path in the vault.
*/

.icons {
  pack: classic;
}

.theme {
  /* background: #1a1b26; */
  /* foreground: #c0caf5; */
  /* primary.background: #7aa2f7; */
  /* sidebar.background: #16161e; */
  /* accent.background: #292e42; */
}

.highlight {
  /* editor.background: #1a1b26; */
  /* syntax.title.color: #e0af68; */
  /* syntax.link_text.color: #7aa2f7; */
}

/* .folder[path="Ideas"] {
  icon: folder-heart;
  color: #f7768e;
} */
`;

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const CLEAR = new Set(["", "inherit", "unset", "initial", "theme", "none"]);

/**
 * @param {string} css
 * @returns {{
 *   icons: { pack: string, folder: string, note: string, file: string },
 *   folders: { path: string, icon: string, open: string, color: string }[],
 *   theme: Record<string, string>,
 *   highlight: Record<string, string>,
 *   warnings: string[],
 * }}
 */
export function parseCss(css) {
  const icons = { pack: "classic", folder: "", note: "", file: "" };
  /** @type {{ path: string, icon: string, open: string, color: string }[]} */
  const folders = [];
  /** @type {Record<string, string>} */
  const theme = {};
  /** @type {Record<string, string>} */
  const highlight = {};
  /** @type {string[]} */
  const warnings = [];
  const source = String(css ?? "").replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks = source.matchAll(/([^{]+)\{([^}]*)\}/g);
  for (const match of blocks) {
    const selector = match[1].trim();
    const folderPath = folderPathOf(selector);
    const highlightBlock = isHighlightBlock(selector);
    /** @type {{ icon: string, open: string, color: string }} */
    const folder = { icon: "", open: "", color: "" };
    for (const piece of match[2].split(";")) {
      const line = piece.trim();
      if (!line) continue;
      const colon = line.indexOf(":");
      if (colon <= 0) continue;
      const property = normalizeProperty(line.slice(0, colon).trim());
      const value = line
        .slice(colon + 1)
        .replace(/!important\s*$/i, "")
        .trim();
      if (folderPath !== null) {
        assignFolder(folder, property, value, warnings);
      } else if (isIconProperty(property)) {
        assignIcon(icons, property, value, warnings);
      } else if (property.startsWith("highlight.") || highlightBlock) {
        const key = property.startsWith("highlight.") ? property.slice("highlight.".length) : property;
        assignColor(highlight, key, value, warnings);
      } else {
        assignColor(theme, property, value, warnings);
      }
    }
    if (folderPath) {
      folders.push({ path: folderPath, ...folder });
    }
  }
  if (!PACKS.some((pack) => pack.id === icons.pack)) {
    warnings.push(`unknown icon pack “${icons.pack}”`);
    icons.pack = "classic";
  }
  return { icons, folders, theme, highlight, warnings };
}

/**
 * The colors and icons `css` asks Notia to draw.
 * @param {string} css
 */
export function appearanceFrom(css) {
  const parsed = parseCss(css);
  const pack = packById(parsed.icons.pack);
  const colors = { ...parsed.theme };
  for (const [key, value] of Object.entries(parsed.highlight)) {
    colors[`highlight.${key}`] = value;
  }
  return {
    warnings: parsed.warnings,
    colors,
    icons: {
      folder: pack.closed,
      folderOpen: pack.open,
      folderColor: parsed.icons.folder || null,
      noteColor: parsed.icons.note || null,
      fileColor: parsed.icons.file || null,
      folders: parsed.folders
        .filter((folder) => folder.path)
        .map((folder) => ({
          path: folder.path,
          icon: folder.icon,
          open: folder.open,
          color: folder.color || null,
        })),
    },
  };
}

/**
 * Sets one declaration, keeping the rest of the file, including comments.
 * An empty value removes the declaration.
 * @param {string} css
 * @param {string} selector
 * @param {string} property
 * @param {string} value
 */
export function setProperty(css, selector, property, value) {
  const lines = String(css ?? "").split("\n");
  let depth = 0;
  let inBlock = false;
  let lastProperty = -1;
  let lastClose = -1;
  let lastOpen = -1;
  for (let index = 0; index < lines.length; index++) {
    const trimmed = lines[index].trim();
    if (depth === 0 && !isCommentLine(trimmed) && selectorOnLine(trimmed, selector)) {
      inBlock = true;
      lastOpen = index;
    }
    if (inBlock && depth >= 1 && isDeclaration(trimmed, property)) {
      lastProperty = index;
    }
    const next = depth + count(lines[index], "{") - count(lines[index], "}");
    if (inBlock && next <= 0) {
      lastClose = index;
      inBlock = false;
    }
    depth = Math.max(0, next);
  }

  const cleaned = value.trim();
  if (lastProperty !== -1) {
    if (!cleaned) {
      lines.splice(lastProperty, 1);
    } else {
      const indent = lines[lastProperty].match(/^\s*/)?.[0] || "  ";
      lines[lastProperty] = `${indent}${property}: ${cleaned};`;
    }
    return lines.join("\n");
  }
  if (!cleaned) return lines.join("\n");
  if (lastClose !== -1) {
    if (lastOpen === lastClose && lines[lastClose].includes("{") && lines[lastClose].includes("}")) {
      const brace = lines[lastClose].indexOf("{");
      lines.splice(lastClose, 1, lines[lastClose].slice(0, brace + 1), `  ${property}: ${cleaned};`, "}");
      return lines.join("\n");
    }
    lines.splice(lastClose, 0, `  ${property}: ${cleaned};`);
    return lines.join("\n");
  }
  const text = lines.join("\n");
  const gap = text.endsWith("\n") || text.length === 0 ? "" : "\n";
  return `${text}${gap}\n${selector} {\n  ${property}: ${cleaned};\n}\n`;
}

/** @param {string} selector */
function folderPathOf(selector) {
  const match = selector.match(/\.folder\s*\[\s*path\s*=\s*(?:"([^"]*)"|'([^']*)')\s*\]/);
  const path = (match?.[1] ?? match?.[2] ?? "").trim().replace(/^\/+|\/+$/g, "");
  return match ? path : null;
}

/** @param {string} selector */
function isHighlightBlock(selector) {
  return /(?:^|[\s,])\.highlight\b/.test(selector) || selector === "highlight";
}

/** @param {string} property */
/** @param {string} property */
function normalizeProperty(property) {
  if (!property.startsWith("--")) return property;
  const name = property.slice(2);
  if (name === "icon-pack") return "pack";
  if (name === "folder-icon") return "folder";
  if (name === "note-icon") return "note";
  if (name === "file-icon") return "file";
  if (name.startsWith("highlight-")) {
    return `highlight.${name.slice("highlight-".length).replace(/-/g, ".")}`;
  }
  return name.replace(/-/g, ".");
}

/** @param {string} property */
function isIconProperty(property) {
  return property === "pack" || property === "folder" || property === "note" || property === "file";
}

/**
 * @param {{ pack: string, folder: string, note: string, file: string }} icons
 * @param {string} property
 * @param {string} value
 * @param {string[]} warnings
 */
function assignIcon(icons, property, value, warnings) {
  if (property === "pack") {
    icons.pack = value.trim().toLowerCase() || "classic";
    return;
  }
  assignColor(icons, property, value, warnings);
}

/**
 * @param {{ icon: string, open: string, color: string }} folder
 * @param {string} property
 * @param {string} value
 * @param {string[]} warnings
 */
function assignFolder(folder, property, value, warnings) {
  if (property === "icon") {
    folder.icon = value.trim();
    return;
  }
  if (property === "open") {
    folder.open = value.trim();
    return;
  }
  if (property === "color" || property === "folder") {
    assignColor(folder, "color", value, warnings);
    return;
  }
  warnings.push(`unknown folder property “${property}”`);
}

/**
 * @param {Record<string, string>} target
 * @param {string} key
 * @param {string} value
 * @param {string[]} warnings
 */
function assignColor(target, key, value, warnings) {
  if (!key) return;
  if (CLEAR.has(value.trim().toLowerCase())) {
    delete target[key];
    return;
  }
  if (!HEX.test(value.trim())) {
    warnings.push(`“${value.trim()}” is not a #hex color`);
    return;
  }
  target[key] = value.trim();
}

/** @param {string} line @param {string} selector */
function selectorOnLine(line, selector) {
  const escaped = escapeRegExp(selector);
  return new RegExp(`(?:^|[\\s,{])${escaped}(?=$|[\\s,{])`).test(line);
}

/** @param {string} line @param {string} property */
function isDeclaration(line, property) {
  if (isCommentLine(line)) return false;
  return new RegExp(`^${escapeRegExp(property)}\\s*:`).test(line);
}

/** @param {string} line */
function isCommentLine(line) {
  return line.startsWith("/*") || line.startsWith("*") || line.startsWith("//");
}

/** @param {string} text @param {string} mark */
function count(text, mark) {
  return text.split(mark).length - 1;
}

/** @param {string} text */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
