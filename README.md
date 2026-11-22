# Theme enhancer

A Notia community plugin. While it is on, the file list shows folder and file icons. While it is off, those icons are absent. It also recolors the icons and overrides the colors of whichever theme is active.

The overrides live in `theme.css` in this folder. The settings page edits that same file: icon colors, theme colors, highlight colors, and a rule per folder. Each group opens on its own, and the raw CSS editor stays closed until you need a line the form does not show. Saving the file in any text editor applies the change. Delete a line, or clear its field, to use the theme's own color again. Turning the plugin off removes every override.

```css
.icons {
  pack: heart;
  folder: #e0af68;
  note: #a9b1d6;
  file: #737aa2;
}

.theme {
  background: #1a1b26;
  foreground: #c0caf5;
  primary.background: #7aa2f7;
  sidebar.background: #16161e;
}

.highlight {
  editor.background: #1a1b26;
  syntax.title.color: #e0af68;
}

.folder[path="Ideas"] {
  icon: folder-heart;
  color: #f7768e;
}
```

`.theme` uses the color names from a theme file's `colors` block. `.highlight` uses the names from its `highlight` block, including `syntax.title.color`. Colors are `#hex`. Custom properties work too: `--primary-background` is `primary.background`.

The icon pack is one of `classic`, `simple`, `stack`, `bookmark`, `dot`, `heart`, `lock`, `tree`, `code`, or `git`. An open folder uses that pack's open icon. A `.folder` rule replaces the icon of one folder, by its path in the vault.

## Install

Link this folder into a vault:

```bash
mkdir -p "/path/to/vault/.notia/plugins"
ln -s "/Users/chakyiu/Documents/project/github/2026/notia-theme-enhancer" \
  "/path/to/vault/.notia/plugins/theme-enhancer"
```

Open the vault, then turn **Theme enhancer** on in **Settings → Plugins**.

## Develop

`notia.d.ts` is a copy of the plugin API. `jsconfig.json` points editors at it. When Notia's API changes, copy the new one from `crates/notia-js/notia.d.ts` in Notia.

## Check

```bash
npm test
npx -p typescript tsc -p jsconfig.json
```
