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

/**
 * A `.folder[path="..."]` selector for `path`, or `""` when the path
 * cannot be quoted the way this file writes rules.
 * @param {string} path
 */
export function folderSelector(path) {
  const cleaned = folderPathValue(path);
  if (!cleaned) return "";
  if (cleaned.includes('"')) return `.folder[path='${cleaned}']`;
  return `.folder[path="${cleaned}"]`;
}

/**
 * The vault path a folder rule can store. Empty when it would not round-trip.
 * @param {string} path
 */
export function folderPathValue(path) {
  const raw = String(path ?? "").trim();
  if (!raw || /[{}<>\r\n]/.test(raw)) return "";
  if (raw.includes('"') && raw.includes("'")) return "";
  const cleaned = raw.replace(/^\/+|\/+$/g, "");
  return cleaned && !/[{}<>]/.test(cleaned) ? cleaned : "";
}

/**
 * How a color field should treat what the user has typed.
 * `clear` deletes the declaration. `set` writes a #hex color.
 * `draft` is unfinished and must not be written.
 * @param {string} value
 * @returns {"clear" | "set" | "draft"}
 */
export function colorEdit(value) {
  const trimmed = String(value ?? "").trim();
  if (CLEAR.has(trimmed.toLowerCase())) return "clear";
  if (HEX.test(trimmed)) return "set";
  return "draft";
}

/** @param {string} name */
export function isThemeColorName(name) {
  const key = name.trim();
  return isPropertyName(key) && !isIconProperty(key) && !key.startsWith("highlight.");
}

/** @param {string} name */
export function isHighlightColorName(name) {
  const key = name.trim();
  return isPropertyName(key) && !key.startsWith("highlight.");
}

/**
 * Removes one rule. Comments and every other rule stay, including ones
 * that only look similar inside a comment.
 * @param {string} css
 * @param {string} selector
 */
export function removeBlock(css, selector) {
  if (!selector) return String(css ?? "");
  const lines = String(css ?? "").split("\n");
  let depth = 0;
  let start = -1;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();
    const opens = count(line, "{");
    const closes = count(line, "}");
    if (start === -1 && depth === 0 && !isCommentLine(trimmed) && selectorOnLine(trimmed, selector)) {
      start = index;
    }
    const next = depth + opens - closes;
    if (start !== -1 && next <= 0 && (opens > 0 || closes > 0 || depth > 0)) {
      lines.splice(start, index - start + 1);
      return lines.join("\n");
    }
    depth = Math.max(0, next);
  }
  return lines.join("\n");
}

/**
 * Renames one selector. Declarations inside the rule, and the rest of the
 * file, are copied through unchanged.
 * @param {string} css
 * @param {string} from
 * @param {string} to
 */
export function renameSelector(css, from, to) {
  const source = String(css ?? "");
  if (!from || !to || from === to) return source;
  const lines = source.split("\n");
  let depth = 0;
  for (let index = 0; index < lines.length; index++) {
    const trimmed = lines[index].trim();
    if (depth === 0 && !isCommentLine(trimmed) && selectorOnLine(trimmed, from)) {
      const at = lines[index].indexOf(from);
      if (at !== -1) {
        lines[index] = lines[index].slice(0, at) + to + lines[index].slice(at + from.length);
      }
    }
    depth = Math.max(0, depth + count(lines[index], "{") - count(lines[index], "}"));
  }
  return lines.join("\n");
}

/** @param {string} name */
function isPropertyName(name) {
  return /^[A-Za-z_][\w.-]*$/.test(name);
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
