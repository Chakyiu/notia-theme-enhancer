import assert from "node:assert/strict";
import test from "node:test";
import { appearanceFrom, parseCss, setProperty } from "../lib/css.js";

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
