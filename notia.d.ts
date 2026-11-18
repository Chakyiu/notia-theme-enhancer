// The plugin API of Notia, for community plugins written in JavaScript or
// TypeScript.
//
// A plugin is a folder with a `manifest.json` and a `main.js` whose default
// export extends `Plugin`. Notia loads the folders in `<vault>/.notia/plugins`,
// and folders linked there, so a plugin can live in a repository of its own:
//
//   ln -s ~/code/my-plugin <vault>/.notia/plugins/my-plugin
//
// Notia reads only the manifest until the plugin is enabled in Settings →
// Plugins, then loads `main.js` and calls `onload`. Disabling the plugin calls
// `onunload` and removes everything it added. Saving its files reloads it.
// Saving `data.json` or a `.css` file does not: the plugin reads those itself.
//
// For editor completions, keep a copy of this file in the plugin's folder.
// The command "Open the community plugins folder" writes the copy matching
// the running Notia to `.notia/plugins/notia.d.ts`.

declare module "notia" {
  /** The contents of `manifest.json`, plus the plugin's folder. */
  export interface PluginManifest {
    id: string;
    name: string;
    version?: string;
    author?: string;
    description?: string;
    /** The entry module, relative to the plugin folder. Defaults to `main.js`. */
    main?: string;
    /** The plugin folder, relative to the vault: `.notia/plugins/<folder>`. */
    dir: string;
    [key: string]: unknown;
  }

  /**
   * The base class of plugins. Register commands, ribbon icons, status bar
   * items and panels in `onload`; Notia removes them when the plugin is
   * disabled.
   */
  export class Plugin {
    constructor(app: App, manifest: PluginManifest);
    readonly app: App;
    readonly manifest: PluginManifest;

    /** Called when the plugin is enabled. May be async. */
    onload(): void | Promise<void>;
    /** Called when the plugin is disabled or reloaded. */
    onunload(): void;

    /** Adds a command to the command palette. */
    addCommand(command: Command): Command;
    /**
     * Adds a button to the ribbon, the strip of icons on the left.
     * @param icon A Lucide icon name, such as `"dices"`: see https://lucide.dev/icons.
     */
    addRibbonIcon(icon: string, title: string, callback: () => unknown): void;
    /** Adds a text item to the status bar. */
    addStatusBarItem(): StatusBarItem;
    /**
     * Adds a panel to a sidebar, or a bar above the open note, drawn from the
     * elements `render` returns.
     */
    addPanel(options: PanelOptions): PanelHandle;
    /**
     * Adds a page of the plugin's options to Settings, listed while the
     * plugin is enabled.
     */
    addSettingTab(options: SettingTabOptions): SettingTabHandle;

    /** Returns `ref`. Event listeners are removed on unload anyway. */
    registerEvent<T>(ref: T): T;
    /** Returns `id`. Intervals are cleared on unload anyway. */
    registerInterval(id: number): number;

    /** Reads `data.json` in the plugin folder, or `null` when there is none. */
    loadData(): Promise<any>;
    /** Writes `data` to `data.json` in the plugin folder. */
    saveData(data: unknown): Promise<void>;

    /**
     * Reads a text file in the plugin folder, or `null` when there is none.
     * `name` is relative to the folder, such as `"theme.css"`.
     */
    readFile(name: string): string | null;
    /** Writes a text file in the plugin folder. */
    writeFile(name: string, text: string): void;
    /** Opens a file in the plugin folder with the system editor. */
    openFile(name: string): void;

    /**
     * Replaces colors of the active theme. Keys are the names from a theme
     * file, such as `"background"` and `"primary.background"`, or
     * `"highlight."` followed by a highlight name, such as
     * `"highlight.syntax.title.color"`. Values are `#hex` colors. An empty
     * object clears every replacement this plugin made. Names and colors
     * Notia does not know are listed in `warnings` and left unchanged.
     */
    setThemeColors(colors: Record<string, string | null>): { warnings: string[] };
    /**
     * Replaces the icons in the file list. `folder` and `folderOpen` are
     * Lucide icon names. A missing color keeps the theme's own color for
     * that kind of icon. `folders` gives one folder, by its vault path, its
     * own icon and color. `null` clears the replacement.
     */
    setFileIcons(icons: FileIcons | null): { warnings: string[] };
  }

  /** Icons a plugin draws in the file list, in place of the built-in ones. */
  export interface FileIcons {
    /** Lucide name for a closed folder, such as `"folder-closed"`. */
    folder?: string;
    /** Lucide name for an open folder. */
    folderOpen?: string;
    /** `#hex` or a theme color name. Empty keeps the theme's yellow. */
    folderColor?: string | null;
    /** Empty keeps the theme's sidebar color. */
    noteColor?: string | null;
    /** Empty keeps the theme's muted color. Attachments keep their glyphs. */
    fileColor?: string | null;
    /** One icon for a folder path. A later entry for the same path wins. */
    folders?: {
      path: string;
      icon?: string;
      open?: string;
      color?: string | null;
    }[];
  }

  /** Shows a notification. */
  export class Notice {
    constructor(message: string);
  }

  export interface Command {
    /** Unique within the plugin. */
    id: string;
    name: string;
    /** A Lucide icon name. */
    icon?: string;
    /**
     * Keystrokes such as `"secondary-shift-k"`, where `secondary` is ⌘ on
     * macOS and Ctrl elsewhere. Modifiers: `cmd`, `ctrl`, `alt`, `shift`,
     * `secondary`.
     */
    hotkey?: string;
    callback?: () => unknown;
    /**
     * Instead of `callback`: called with the active note's editor, and
     * listed only while a note is open.
     */
    editorCallback?: (editor: Editor, note: ActiveNote) => unknown;
  }

  export interface StatusBarItem {
    setText(text: string): StatusBarItem;
  }

  export interface PanelOptions {
    /** Unique within the plugin. */
    id: string;
    title: string;
    /** A Lucide icon name, shown in the sidebar header. */
    icon?: string;
    /**
     * Defaults to `"right"`. `"editor"` draws the panel as a single row of
     * icons above the note title instead of docking it in a sidebar.
     */
    side?: "left" | "right" | "editor";
    /**
     * Returns what the panel shows. Notia calls it when the panel is first
     * shown, and again after `refresh()`.
     */
    render(): Element | Element[] | string | null;
  }

  export interface PanelHandle {
    /** Renders the panel again. */
    refresh(): void;
    /** Opens the panel's sidebar and selects the panel. */
    show(): void;
  }

  export interface SettingTabOptions {
    /** The page's name in Settings. Defaults to the plugin's name. */
    title?: string;
    /** A Lucide icon name, shown beside the name. */
    icon?: string;
    /**
     * Returns the page: `ui.setting` rows, and other elements between them.
     * `ui.heading` starts a new section. Notia calls it when the page is
     * shown, after each change made on it, and after `refresh()`. Show the
     * values you store: a control shows what `render` gives it.
     */
    render(): Element | Element[] | string | null;
  }

  export interface SettingTabHandle {
    /** Shows values changed elsewhere, such as by a command. */
    refresh(): void;
  }

  /** The building blocks of panels. */
  export const ui: {
    column(children: Child[], options?: object): Element;
    /** `wrap: false` keeps children on one line. */
    row(children: Child[], options?: { wrap?: boolean }): Element;
    /** A small section heading, like those of the core panels. */
    heading(text: string): Element;
    text(text: string, options?: { muted?: boolean; bold?: boolean; small?: boolean }): Element;
    markdown(source: string): Element;
    button(
      label: string,
      onClick: () => unknown,
      options?: {
        icon?: string;
        variant?: "outline" | "primary" | "ghost";
        /** Shown on hover. An empty label with an icon is an icon button. */
        tooltip?: string;
      },
    ): Element;
    list(items: (ListItem | string)[]): Element;
    separator(): Element;
    /** A centered, muted message for when there is nothing to show. */
    empty(text: string): Element;

    /**
     * A row of a settings tab: a name, and a control beside it. The control
     * is one of those below, or any element, such as a button. Settings and
     * their controls show only at the top level of a settings tab.
     */
    setting(name: string, control: Child, options?: { description?: string }): Element;
    /** A switch. */
    toggle(value: boolean, onChange: (value: boolean) => unknown): Element;
    /** A text field. `onChange` runs as the text changes. */
    textInput(value: string, onChange: (value: string) => unknown): Element;
    /**
     * A multi-line text field. `onChange` runs as the text changes.
     * `id` keeps the field when the settings page renders again, and `rows`
     * is how tall it is.
     */
    textArea(
      value: string,
      onChange: (value: string) => unknown,
      options?: { id?: string; rows?: number },
    ): Element;
    /** A number field that keeps the value between `min` and `max`. */
    numberInput(
      value: number,
      onChange: (value: number) => unknown,
      options?: { min?: number; max?: number; step?: number },
    ): Element;
    /** A menu of options: values, `[value, label]` pairs, or `{ value, label }`. */
    dropdown(
      value: string,
      options: (string | [value: string, label: string] | { value: string; label: string })[],
      onChange: (value: string) => unknown,
    ): Element;
  };

  /** An element made by `ui`. */
  export interface Element {
    type: string;
  }

  /** Children may also be strings, and `null`, `undefined` or booleans, which are left out. */
  export type Child = Element | string | null | undefined | boolean;

  export interface ListItem {
    title: string;
    subtitle?: string;
    /** A Lucide icon name. */
    icon?: string;
    onClick?: () => unknown;
  }

  export interface App {
    vault: Vault;
    workspace: Workspace;
    metadata: Metadata;
  }

  /** An event listener registration. */
  export interface EventRef {
    off(): void;
  }

  /**
   * The notes of the vault. Paths are relative to the vault, like
   * `Folder/Note.md`; `.md` may be left out. Hidden files are out of reach.
   */
  export interface Vault {
    getName(): string;
    /** Every note, sorted by path. */
    getNotes(): NoteInfo[];
    /** The note's text on disk. */
    read(path: string): string;
    exists(path: string): boolean;
    /** Creates a note and returns its path. Fails if it exists. */
    create(path: string, text?: string): string;
    /** Replaces the text of an existing note. */
    modify(path: string, text: string): void;
    /** Adds text on a new line at the end of a note, creating it if needed. */
    append(path: string, text: string): void;

    /** A note was created or changed, by Notia or on disk. */
    on(event: "modify", callback: (path: string) => unknown): EventRef;
    on(event: "rename", callback: (path: string, oldPath: string) => unknown): EventRef;
    on(event: "delete", callback: (path: string) => unknown): EventRef;
    /** Anything in the vault changed. */
    on(event: "change", callback: () => unknown): EventRef;
  }

  export interface NoteInfo {
    path: string;
    /** The file name without `.md`. */
    name: string;
    tags: string[];
    words: number;
    /** Milliseconds since 1970. */
    modified: number | null;
  }

  export interface ActiveNote {
    path: string;
    name: string;
    /** The text in the editor, including unsaved edits. */
    text: string;
    /** The 0-based line of the cursor. */
    line: number;
    mode: "editing" | "half" | "preview";
  }

  export interface OpenOptions {
    /** The 0-based line to place the cursor on. */
    line?: number;
    newTab?: boolean;
  }

  export interface Workspace {
    getActiveNote(): ActiveNote | null;
    /** The editor of the active note, or `null` when no note is open. */
    getActiveEditor(): Editor | null;
    openNote(path: string, options?: OpenOptions): void;
    /** Opens what a `[[link]]` points at, creating the note if needed. */
    openLink(target: string, options?: { newTab?: boolean }): void;
    /** Creates a note in `folder`, or the configured folder, and opens it. */
    newNote(folder?: string | null): void;
    /** Inserts text at the cursor of the active note and focuses the note. */
    insertText(text: string): void;
    /** Moves the cursor of the active note to a 0-based line. */
    revealLine(line: number): void;
    /** Searches the vault, like `"tag:#ideas"` or `"meeting"`. */
    search(query: string): void;
    /** Runs a command by id; ids without `plugin:` are this plugin's. */
    runCommand(id: string): void;

    /** Another note, or no note, became active. */
    on(event: "file-open", callback: (note: ActiveNote | null) => unknown): EventRef;
    /** The text of the active note changed. */
    on(event: "editor-change", callback: (note: ActiveNote) => unknown): EventRef;
  }

  /**
   * A place in a note: a 0-based line, and a column counted like JavaScript
   * string indices, in UTF-16 code units.
   */
  export interface EditorPosition {
    line: number;
    ch: number;
  }

  export interface EditorRange {
    from: EditorPosition;
    to: EditorPosition;
  }

  /** `head` is the cursor, and `anchor` the end that stays put while selecting. */
  export interface EditorSelection {
    anchor: EditorPosition;
    head: EditorPosition;
  }

  /** Replaces `from`–`to` with `text`, or inserts it at `from` without `to`. */
  export interface EditorChange {
    from: EditorPosition;
    to?: EditorPosition;
    text: string;
  }

  export interface EditorTransaction {
    /** Positions in the text before any of the changes, which must not overlap. */
    changes?: EditorChange[];
    /** Also replaces the selection, and puts the cursor after the new text. */
    replaceSelection?: string;
    /** The selection afterwards, as positions in the text after the changes. */
    selection?: { from: EditorPosition; to?: EditorPosition };
  }

  /**
   * The text of an open note, like Obsidian's `Editor`.
   *
   * Reads include the edits made through any editor, even before the note
   * shows them, which it does as soon as the plugin's code returns. Each
   * edit is one step for undo. An edit that does not set the selection
   * leaves it on the text it was on.
   */
  export interface Editor {
    getDoc(): Editor;
    /** Does nothing: notes show edits by themselves. */
    refresh(): void;
    getValue(): string;
    setValue(text: string): void;
    /** A line without its line break, or `""` past the last line. */
    getLine(line: number): string;
    setLine(line: number, text: string): void;
    lineCount(): number;
    lastLine(): number;
    getSelection(): string;
    somethingSelected(): boolean;
    getRange(from: EditorPosition, to: EditorPosition): string;
    /** Replaces the selection and puts the cursor after the new text. */
    replaceSelection(text: string): void;
    /** Replaces `from`–`to`, or inserts at `from` without `to`. */
    replaceRange(text: string, from: EditorPosition, to?: EditorPosition): void;
    /** Defaults to `"head"`, the cursor. */
    getCursor(which?: "from" | "to" | "head" | "anchor"): EditorPosition;
    /** The selection; a note has one. */
    listSelections(): EditorSelection[];
    setCursor(position: EditorPosition | number, ch?: number): void;
    setSelection(anchor: EditorPosition, head?: EditorPosition): void;
    /** Selects `ranges[main]`, since a note has one selection. */
    setSelections(ranges: { anchor: EditorPosition; head?: EditorPosition }[], main?: number): void;
    /** Makes several changes as one step for undo. */
    transaction(transaction: EditorTransaction): void;
    posToOffset(position: EditorPosition): number;
    offsetToPos(offset: number): EditorPosition;
    /** The run of letters, digits and `_` around `position`. */
    wordAt(position: EditorPosition): EditorRange | null;
    /** Puts the keyboard focus in the note's text, leaving preview. */
    focus(): void;
    /** Undoes the last edit, like ⌘Z, once the plugin's code returns. */
    undo(): void;
    /** Redoes the last undone edit, once the plugin's code returns. */
    redo(): void;
  }

  export interface Metadata {
    getHeadings(path: string): { level: number; text: string; line: number }[];
    getLinks(path: string): {
      target: string;
      subpath: string | null;
      display: string | null;
      line: number;
      embed: boolean;
      /** The note the link points at, or `null` if it does not exist. */
      resolved: string | null;
    }[];
    getBacklinks(path: string): { source: string; line: number; context: string }[];
    /** Every tag, without `#`, with the number of notes using it, most used first. */
    getTags(): { tag: string; count: number }[];
    getNotesWithTag(tag: string): string[];
    /** The note a link target means, seen from the note `from`. */
    resolveLink(target: string, from?: string | null): string | null;
  }

  const api: { Plugin: typeof Plugin; Notice: typeof Notice; ui: typeof ui };
  export default api;
}
