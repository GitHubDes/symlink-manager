export interface ElectronRemoteApi {
  dialog?: {
    showOpenDialog(
      window: unknown,
      options: {
        title: string;
        defaultPath?: string;
        properties: Array<"openDirectory" | "openFile">;
      },
    ): Promise<{ canceled: boolean; filePaths: string[] }>;
  };
  getCurrentWindow?: () => unknown;
}

export function loadElectronRemote(): ElectronRemoteApi {
  try {
    return require("@electron/remote") as ElectronRemoteApi;
  } catch {
    return require("electron").remote as ElectronRemoteApi;
  }
}