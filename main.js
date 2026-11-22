import { Plugin, ui } from "notia";
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
} from "./lib/css.js";
import { PACKS } from "./lib/packs.js";

const CSS_FILE = "theme.css";

export default class ThemeEnhancer extends Plugin {
  /**
   * @param {import("notia").App} app
   * @param {import("notia").PluginManifest} manifest
   */
  constructor(app, manifest) {
    super(app, manifest);
    this.css = DEFAULT_CSS;
    /** @type {string[]} */
    this.warnings = [];
    this.localEditAt = 0;
    /** @type {import("notia").SettingTabHandle | undefined} */
    this.tab = undefined;
    /** In-progress fields. Partials stay here until they are a real value. */
    /** @type {Record<string, string>} */
    this.drafts = {};
    /** @type {{ theme: boolean, highlight: boolean, folders: boolean, css: boolean }} */
    this.sections = { theme: false, highlight: false, folders: false, css: false };
    this.sectionDefaultsSet = false;
    /** @type {{ name: string, value: string }} */
    this.addTheme = { name: "", value: "" };
    /** @type {{ name: string, value: string }} */
    this.addHighlight = { name: "", value: "" };
    this.addFolderPath = "";
    this.addFolderIcon = "";
    this.addFolderColor = "";
  }

  async onload() {
    let saved = null;
    try {
      saved = await this.readFile(CSS_FILE);
    } catch (error) {
      console.error(error);
    }
    this.css = typeof saved === "string" && saved.trim() ? saved : DEFAULT_CSS;
    if (typeof saved !== "string") {
      try {
        await this.writeFile(CSS_FILE, this.css);
      } catch (error) {
        console.error(error);
      }
    }
    this.apply();
    this.tab = this.addSettingTab({
      icon: "palette",
      render: () => this.renderSettings(),
    });
    this.addCommand({
      id: "open-css",
      name: "Open theme CSS",
      icon: "palette",
      callback: () => this.openFile(CSS_FILE),
    });
    this.registerInterval(setInterval(() => this.poll(), 700));
  }

  apply() {
    const appearance = appearanceFrom(this.css);
    const colors = this.setThemeColors(appearance.colors);
    const icons = this.setFileIcons(appearance.icons);
    this.warnings = [...appearance.warnings, ...(colors?.warnings ?? []), ...(icons?.warnings ?? [])];
  }

  /**
   * @param {string} selector
   * @param {string} property
   * @param {string} value
   */
  edit(selector, property, value) {
    // shortcut: writes the canonical rule only. A later custom property for the same color still wins, until that line is edited too.
    if (!selector) return;
    this.onCss(setProperty(this.css, selector, property, value));
  }

  /** @param {string} css */
  onCss(css) {
    this.css = css;
    this.localEditAt = Date.now();
    this.apply();
    try {
      this.writeFile(CSS_FILE, css);
    } catch (error) {
      console.error(error);
    }
    this.tab?.refresh();
  }

  async poll() {
    if (Date.now() - this.localEditAt < 800) return;
    let disk = null;
    try {
      disk = await this.readFile(CSS_FILE);
    } catch {
      return;
    }
    if (typeof disk !== "string" || disk === this.css) return;
    this.css = disk;
    this.drafts = {};
    this.apply();
    this.tab?.refresh();
  }

  /** @returns {import("notia").Element[]} */
  renderSettings() {
    const parsed = parseCss(this.css);
    if (!this.sectionDefaultsSet) {
      this.sections.theme = Object.keys(parsed.theme).length > 0;
      this.sections.highlight = Object.keys(parsed.highlight).length > 0;
      this.sections.folders = parsed.folders.length > 0;
      this.sectionDefaultsSet = true;
    }
    const warning = this.warnings.filter((item, index) => this.warnings.indexOf(item) === index);
    return [
      ui.heading("Folder icons"),
      ui.setting(
        "Icon pack",
        ui.dropdown(
          parsed.icons.pack,
          PACKS.map((pack) => [pack.id, pack.label]),
          (pack) => this.edit(".icons", "pack", pack),
        ),
        { description: "The folder icon in the file list. An open folder uses the pack's open icon." },
      ),
      ui.setting(
        "Folder color",
        this.colorInput(".icons", "folder", parsed.icons.folder),
        { description: "A #hex color, such as #e0af68. Clear it to use the theme's yellow." },
      ),
      ui.setting("Note color", this.colorInput(".icons", "note", parsed.icons.note), {
        description: "Clear it to use the theme's sidebar color.",
      }),
      ui.setting("File color", this.colorInput(".icons", "file", parsed.icons.file), {
        description: "Recolors attachments. Their icons still follow the file type.",
      }),
      ...this.colorSection(
        "Theme colors",
        ".theme",
        parsed.theme,
        "theme",
        this.addTheme,
        "Names from the theme file's colors, such as primary.background. Clear a field to use the theme's own color.",
        isThemeColorName,
      ),
      ...this.colorSection(
        "Highlight colors",
        ".highlight",
        parsed.highlight,
        "highlight",
        this.addHighlight,
        "Names from the theme file's highlight block, such as syntax.title.color. Clear a field to use the theme's own color.",
        isHighlightColorName,
      ),
      ...this.folderSection(parsed.folders),
      ...(warning.length ? [ui.text(warning.join("\n"), { small: true })] : []),
      ui.setting("Theme file", ui.button("Open theme.css", () => this.openFile(CSS_FILE)), {
        description: "Opens theme.css in your editor. Saving the file applies it.",
      }),
      ui.setting("Edit CSS", ui.toggle(this.sections.css, (open) => this.setSection("css", open)), {
        description: "The file above is what these settings edit. Open this for a line the form does not show.",
      }),
      ...(this.sections.css
        ? [
            ui.text("Delete a line to use the theme's own value again. Other lines are left as they are.", {
              muted: true,
              small: true,
            }),
            ui.textArea(this.css, (css) => {
              this.drafts = {};
              this.onCss(css);
            }, { id: "theme-css", rows: 10 }),
          ]
        : []),
    ];
  }

  /**
   * @param {"theme" | "highlight" | "folders" | "css"} section
   * @param {boolean} open
   */
  setSection(section, open) {
    this.sections[section] = open;
    this.tab?.refresh();
  }

  /**
   * @param {string} selector
   * @param {string} property
   * @param {string} current
   */
  colorInput(selector, property, current) {
    const id = `${selector} ${property}`;
    const shown = Object.prototype.hasOwnProperty.call(this.drafts, id) ? this.drafts[id] : current;
    return ui.textInput(shown, (value) => {
      const kind = colorEdit(value);
      if (kind === "draft") {
        this.drafts[id] = value;
        this.tab?.refresh();
        return;
      }
      delete this.drafts[id];
      this.edit(selector, property, kind === "set" ? value.trim() : "");
    });
  }

  /**
   * @param {string} title
   * @param {string} selector
   * @param {Record<string, string>} colors
   * @param {"theme" | "highlight"} section
   * @param {{ name: string, value: string }} draft
   * @param {string} hint
   * @param {(name: string) => boolean} validName
   * @returns {import("notia").Element[]}
   */
  colorSection(title, selector, colors, section, draft, hint, validName) {
    const keys = Object.keys(colors);
    /** @type {import("notia").Element[]} */
    const rows = [
      ui.setting(title, ui.toggle(this.sections[section], (open) => this.setSection(section, open)), {
        description: listed(keys, "No overrides"),
      }),
    ];
    if (!this.sections[section]) return rows;
    rows.push(ui.text(hint, { muted: true, small: true }));
    for (const key of keys) {
      rows.push(ui.setting(key, this.colorInput(selector, key, colors[key])));
    }
    rows.push(
      ui.setting("Color name", ui.textInput(draft.name, (name) => {
        draft.name = name;
        this.tab?.refresh();
      })),
    );
    const name = draft.name.trim();
    if (!name) return rows;
    if (!validName(name)) {
      rows.push(ui.text("Use a color name from the theme file, such as sidebar.background.", { muted: true, small: true }));
      return rows;
    }
    rows.push(
      ui.setting("Hex", ui.textInput(draft.value, (value) => {
        draft.value = value;
        this.tab?.refresh();
      })),
    );
    if (colorEdit(draft.value) === "set") {
      rows.push(
        ui.setting(
          "Add",
          ui.button("Add color", () => {
            const key = draft.name.trim();
            const value = draft.value.trim();
            draft.name = "";
            draft.value = "";
            this.edit(selector, key, value);
          }, { variant: "outline" }),
        ),
      );
    } else if (draft.value.trim()) {
      rows.push(ui.text("Use a #hex color, such as #7aa2f7.", { muted: true, small: true }));
    }
    return rows;
  }

  /**
   * @param {{ path: string, icon: string, open: string, color: string }[]} folders
   * @returns {import("notia").Element[]}
   */
  folderSection(folders) {
    /** @type {import("notia").Element[]} */
    const rows = [
      ui.setting("Folders", ui.toggle(this.sections.folders, (open) => this.setSection("folders", open)), {
        description: listed(folders.map((folder) => folder.path), "No folder overrides"),
      }),
    ];
    if (!this.sections.folders) return rows;
    rows.push(
      ui.text("One folder, by its path in the vault. Icon is a Lucide name, such as folder-heart.", {
        muted: true,
        small: true,
      }),
    );
    folders.forEach((folder) => {
      const selector = folderSelector(folder.path);
      const pathKey = `path ${selector || folder.path}`;
      const pathDraft = Object.prototype.hasOwnProperty.call(this.drafts, pathKey) ? this.drafts[pathKey] : folder.path;
      rows.push(ui.heading(folder.path));
      rows.push(
        ui.setting("Path", ui.textInput(pathDraft, (value) => {
          this.drafts[pathKey] = value;
          this.tab?.refresh();
        })),
      );
      const renamed = folderPathValue(pathDraft);
      if (pathDraft.trim() && !renamed) {
        rows.push(ui.text("That path cannot be written as a folder rule.", { muted: true, small: true }));
      } else if (renamed && renamed !== folder.path && folders.some((other) => other.path === renamed)) {
        rows.push(ui.text("Another rule already uses that path.", { muted: true, small: true }));
      } else if (renamed && renamed !== folder.path && selector) {
        rows.push(
          ui.setting(
            "Rename",
            ui.button("Rename", () => {
              const next = folderSelector(renamed);
              if (!next) return;
              delete this.drafts[pathKey];
              this.onCss(renameSelector(this.css, selector, next));
            }, { variant: "outline" }),
          ),
        );
      }
      rows.push(
        ui.setting("Icon", ui.textInput(folder.icon, (icon) => this.edit(selector, "icon", icon.trim()))),
      );
      rows.push(
        ui.setting("Open icon", ui.textInput(folder.open, (icon) => this.edit(selector, "open", icon.trim()))),
      );
      rows.push(ui.setting("Color", this.colorInput(selector, "color", folder.color)));
      if (selector) {
        rows.push(
          ui.setting(
            "Rule",
            ui.button("Remove", () => {
              delete this.drafts[pathKey];
              this.onCss(removeBlock(this.css, selector));
            }, { variant: "ghost" }),
          ),
        );
      }
    });
    rows.push(
      ui.setting("Folder path", ui.textInput(this.addFolderPath, (value) => {
        this.addFolderPath = value;
        this.tab?.refresh();
      })),
    );
    const path = folderPathValue(this.addFolderPath);
    if (this.addFolderPath.trim() && !path) {
      rows.push(ui.text("That path cannot be written as a folder rule.", { muted: true, small: true }));
      return rows;
    }
    if (!path) return rows;
    rows.push(
      ui.setting("Icon", ui.textInput(this.addFolderIcon, (icon) => {
        this.addFolderIcon = icon;
        this.tab?.refresh();
      })),
    );
    rows.push(
      ui.setting("Color", ui.textInput(this.addFolderColor, (color) => {
        this.addFolderColor = color;
        this.tab?.refresh();
      })),
    );
    const colorKind = colorEdit(this.addFolderColor);
    const colorOk = !this.addFolderColor.trim() || colorKind === "set";
    if (colorOk && (this.addFolderIcon.trim() || colorKind === "set")) {
      rows.push(
        ui.setting(
          "Add",
          ui.button("Add folder", () => this.commitFolder(path), { variant: "outline" }),
        ),
      );
    } else if (this.addFolderColor.trim() && colorKind === "draft") {
      rows.push(ui.text("Use a #hex color, such as #f7768e.", { muted: true, small: true }));
    }
    return rows;
  }

  /** @param {string} path */
  commitFolder(path) {
    const selector = folderSelector(path);
    const icon = this.addFolderIcon.trim();
    const colorKind = colorEdit(this.addFolderColor);
    if (!selector || (!icon && colorKind !== "set")) return;
    let css = this.css;
    if (icon) css = setProperty(css, selector, "icon", icon);
    if (colorKind === "set") css = setProperty(css, selector, "color", this.addFolderColor.trim());
    this.addFolderPath = "";
    this.addFolderIcon = "";
    this.addFolderColor = "";
    this.onCss(css);
  }
}

/**
 * @param {string[]} items
 * @param {string} empty
 */
function listed(items, empty) {
  if (items.length === 0) return empty;
  const shown = items.slice(0, 3).join(", ");
  return items.length > 3 ? `${shown} +${items.length - 3}` : shown;
}
