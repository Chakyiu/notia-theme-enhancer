import { Plugin, ui } from "notia";
import { appearanceFrom, DEFAULT_CSS, parseCss, setProperty } from "./lib/css.js";
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
    this.apply();
    this.tab?.refresh();
  }

  renderSettings() {
    const parsed = parseCss(this.css);
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
        ui.textInput(parsed.icons.folder, (color) => this.edit(".icons", "folder", color)),
        { description: "A #hex color, such as #e0af68. Leave empty to use the theme's yellow." },
      ),
      ui.setting(
        "Note color",
        ui.textInput(parsed.icons.note, (color) => this.edit(".icons", "note", color)),
        { description: "Leave empty to use the theme's sidebar color." },
      ),
      ui.setting(
        "File color",
        ui.textInput(parsed.icons.file, (color) => this.edit(".icons", "file", color)),
        { description: "Recolors attachments. Their icons still follow the file type." },
      ),
      ui.heading("Theme CSS"),
      ui.text(
        "Colors here replace the active theme. Edit this CSS, or edit theme.css in the plugin folder and save it. Delete a line to use the theme's own color again.",
        { muted: true, small: true },
      ),
      ...(warning.length ? [ui.text(warning.join("\n"), { small: true })] : []),
      ui.textArea(this.css, (css) => this.onCss(css), { id: "theme-css", rows: 18 }),
      ui.setting("Theme file", ui.button("Open theme.css", () => this.openFile(CSS_FILE)), {
        description: "Opens theme.css in your editor. Saving the file applies it.",
      }),
    ];
  }
}
