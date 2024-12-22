
declare module "obsidian" {
    interface App {
        dom: {
            appContainerEl: HTMLElement;
        };
        internalPlugins: {
            plugins: InternalPlugins;
            getPluginById<T extends keyof InternalPlugins>(id: T): InternalPlugins[T];
        };
        plugins: {
            enabledPlugins: Set<string>;
            plugins: {
                ['obsidian-icon-folder']?: {
                    // api: {
                    //     getIconByName: (iconNameWithPrefix: string) => {}
                    // };
                };
            };
        };
    }
    interface InternalPlugin {
        disable(): void;
        enable(): void;
        enabled: boolean;
        _loaded: boolean;
        instance: { name: string; id: string };
    }
    interface InternalPlugins {
        "page-preview": InternalPlugin;
        "markdown-renderer": InternalPlugin;
    }
    interface Vault {
        getConfig: (key: string) => string;
        exists: (path: string) => Promise<boolean>;
        getAvailablePath: (path: string, extension: string) => string;
        getAbstractFileByPathInsensitive: (path: string) => string;
    }

    interface DataAdapter {
        basePath: string;
        fs: {
            uri: string;
        };
    }

    interface Workspace {
        on(
            name: "templater:all-templates-executed",
            callback: () => unknown
        ): EventRef;
    }

    interface EventRef {
        e: Events;
    }

    interface MarkdownSubView {
        applyFoldInfo(foldInfo: FoldInfo): void;
        getFoldInfo(): FoldInfo | null;
    }

    interface FoldInfo {
        folds: FoldRange[];
        lines: number;
    }

    interface FoldRange {
        from: number;
        to: number;
    }
}

export { };
