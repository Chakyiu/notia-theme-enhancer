import assert from "node:assert/strict";
import test from "node:test";
import {
  appearanceFrom,
  colorEdit,
  DEFAULT_CSS,
  folderPathValue,
  folderSelector,
  isHighlightColorName,
  isThemeColorName,
  parseCss,
  removeBlock,
  renameSelector,
  setProperty,
} from "../lib/css.js";

test("comments and empty colors leave the theme alone", () => {
  const parsed = parseCss(`
    .icons { pack: classic; }
    .theme {
      /* background: #111111; */
    }
  `);
  assert.equal(parsed.icons.pack, "classic");
  assert.deepEqual(parsed.theme, {});
  assert.deepEqual(parsed.highlight, {});
  assert.deepEqual(parsed.warnings, []);
});

test("theme colors, highlight colors, and custom properties", () => {
  const parsed = parseCss(`
    :root { --primary-background: #abcdef; --folder-icon: #e0af68; }
    .highlight { editor.background: #112233; syntax.title.color: #445566; }
    .theme { background: #010203; background: #aabbcc; }
  `);
  assert.equal(parsed.icons.folder, "#e0af68");
  assert.equal(parsed.theme.background, "#aabbcc");
  assert.equal(parsed.theme["primary.background"], "#abcdef");
  assert.equal(parsed.highlight["editor.background"], "#112233");
  assert.equal(parsed.highlight["syntax.title.color"], "#445566");
});

test("a folder rule names one path", () => {
  const parsed = parseCss(`
    .folder[path="Ideas"] { icon: folder-heart; color: #f7768e; }
    .folder[path='Ideas'] { icon: folder-lock; }
  `);
  assert.equal(parsed.folders.length, 2);
  assert.deepEqual(parsed.folders[1], {
    path: "Ideas",
    icon: "folder-lock",
    open: "",
    color: "",
  });
});

test("bad colors and packs are warnings", () => {
  const parsed = parseCss(`
    .icons { pack: sparkles; folder: yellow; }
    .theme { background: #12; }
  `);
  assert.equal(parsed.icons.pack, "classic");
  assert.equal(parsed.theme.background, undefined);
  assert.equal(parsed.warnings.length, 3);
});

test("setProperty edits one declaration and keeps comments", () => {
  const css = `.icons {\n  pack: classic;\n}\n\n.theme {\n  /* background: #111111; */\n}\n`;
  const next = setProperty(css, ".icons", "folder", "#e0af68");
  assert.match(next, /pack: classic;/);
  assert.match(next, /folder: #e0af68;/);
  assert.match(next, /\/\* background: #111111; \*\//);
  const cleared = setProperty(next, ".icons", "folder", "");
  assert.doesNotMatch(cleared, /folder:/);
  assert.match(cleared, /pack: classic;/);
});

test("appearanceFrom sends highlight keys with a prefix", () => {
  const appearance = appearanceFrom(`
    .icons { pack: heart; note: #aabbcc; }
    .highlight { syntax.title.color: #445566; }
    .folder[path="Ideas"] { icon: folder-lock; color: #ff00aa; }
  `);
  assert.equal(appearance.icons.folder, "folder-heart");
  assert.equal(appearance.icons.folderOpen, "folder-open");
  assert.equal(appearance.icons.noteColor, "#aabbcc");
  assert.equal(appearance.colors["highlight.syntax.title.color"], "#445566");
  assert.deepEqual(appearance.icons.folders, [
    { path: "Ideas", icon: "folder-lock", open: "", color: "#ff00aa" },
  ]);
});

test("theme, highlight, and folder edits keep the rest of the file", () => {
  let css = setProperty(DEFAULT_CSS, ".theme", "background", "#010203");
  css = setProperty(css, ".highlight", "syntax.title.color", "#445566");
  css = setProperty(css, folderSelector("Notes/Ideas"), "icon", "folder-heart");
  css = setProperty(css, folderSelector("Notes/Ideas"), "color", "#f7768e");
  const parsed = parseCss(css);
  assert.equal(parsed.theme.background, "#010203");
  assert.equal(parsed.highlight["syntax.title.color"], "#445566");
  assert.deepEqual(parsed.folders.at(-1), {
    path: "Notes/Ideas",
    icon: "folder-heart",
    open: "",
    color: "#f7768e",
  });
  assert.match(css, /Icon pack: classic/);
  assert.match(css, /\/\* background: #1a1b26; \*\//);
  assert.match(css, /\/\* \.folder\[path="Ideas"\]/);
  const cleared = setProperty(css, ".theme", "background", "");
  assert.equal(parseCss(cleared).theme.background, undefined);
  assert.match(cleared, /syntax\.title\.color: #445566;/);
  assert.match(cleared, /\/\* \.folder\[path="Ideas"\]/);
});

test("removeBlock and renameSelector leave unknown css untouched", () => {
  const css = [
    ".icons { pack: heart; }",
    '.folder[path="Ideas"] {',
    "  icon: folder-heart;",
    "  color: #f7768e;",
    "  mood: calm;",
    "}",
    ".extra { foo: bar; }",
    '/* .folder[path="Ideas"] { icon: no; } */',
  ].join("\n");
  const colored = setProperty(css, folderSelector("Ideas"), "color", "#112233");
  assert.match(colored, /mood: calm;/);
  assert.match(colored, /color: #112233;/);
  assert.match(colored, /\.extra \{ foo: bar; \}/);
  const renamed = renameSelector(colored, folderSelector("Ideas"), folderSelector("Notes"));
  assert.match(renamed, /^\.folder\[path="Notes"\] \{$/m);
  assert.doesNotMatch(renamed, /^\.folder\[path="Ideas"\]/m);
  assert.match(renamed, /mood: calm;/);
  assert.match(renamed, /\/\* \.folder\[path="Ideas"\] \{ icon: no; \} \*\//);
  const removed = removeBlock(renamed, folderSelector("Notes"));
  assert.doesNotMatch(removed, /mood: calm/);
  assert.match(removed, /\.icons \{ pack: heart; \}/);
  assert.match(removed, /\.extra \{ foo: bar; \}/);
  assert.match(removed, /\/\* \.folder\[path="Ideas"\] \{ icon: no; \} \*\//);
  assert.equal(parseCss(removed).folders.length, 0);
  const inline = removeBlock(
    `.icons { pack: classic; }\n.folder[path="A"] { icon: folder; }\n.extra { a: b; }\n`,
    folderSelector("A"),
  );
  assert.match(inline, /\.icons \{ pack: classic; \}/);
  assert.match(inline, /\.extra \{ a: b; \}/);
  assert.doesNotMatch(inline, /path="A"/);
});

test("a folder path with a double quote round-trips", () => {
  const path = `Say "hi"`;
  assert.equal(folderPathValue(path), path);
  assert.equal(folderSelector(path), `.folder[path='Say "hi"']`);
  assert.equal(folderSelector(`both "and '`), "");
  const css = setProperty("", folderSelector(path), "icon", "folder-heart");
  assert.equal(parseCss(css).folders[0].path, path);
});

test("color fields know a finished value from a partial one", () => {
  assert.equal(colorEdit(""), "clear");
  assert.equal(colorEdit("none"), "clear");
  assert.equal(colorEdit("#abc"), "set");
  assert.equal(colorEdit("#AABBCC"), "set");
  assert.equal(colorEdit("#ab"), "draft");
  assert.equal(colorEdit("yellow"), "draft");
  assert.equal(isThemeColorName("primary.background"), true);
  assert.equal(isThemeColorName("folder"), false);
  assert.equal(isThemeColorName("highlight.foo"), false);
  assert.equal(isHighlightColorName("syntax.title.color"), true);
  assert.equal(isHighlightColorName("highlight.syntax.title.color"), false);
});
