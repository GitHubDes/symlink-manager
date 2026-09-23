declare module "electron" {
  export const ipcRenderer: {
    sendSync(channel: string, ...args: unknown[]): unknown;
  };

  export const shell: {
    openPath(path: string): Promise<string>;
    showItemInFolder(path: string): void;
  };
}
