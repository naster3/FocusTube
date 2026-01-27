declare module "sql.js" {
  export type SqlJsConfig = {
    locateFile?: (file: string) => string;
  };

  export type SqlJsStatic = {
    Database: new (data?: Uint8Array) => Database;
  };

  export type RowObject = Record<string, unknown>;

  export type Statement = {
    run(values?: unknown[]): void;
    free(): void;
    bind(values?: unknown[]): void;
    step(): boolean;
    getAsObject(): RowObject;
    reset(): void;
  };

  export class Database {
    constructor(data?: Uint8Array);
    exec(sql: string): unknown;
    prepare(sql: string): Statement;
    export(): Uint8Array;
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}
