declare module "slsk-client" {
  interface ConnectOptions {
    user: string;
    pass: string;
    sharedFolders?: string[];
  }

  interface SlskClient {
    search(
      options: { req: string; timeout?: number },
      callback: (err: Error | null, results: unknown[]) => void
    ): void;
    download(
      options: { file: { user: string; file: string }; path?: string },
      callback: (err: Error | null, result: unknown) => void
    ): void;
    destroy(): void;
  }

  function connect(
    options: ConnectOptions,
    callback: (err: Error | null, client: SlskClient) => void
  ): void;

  export default { connect };
}
