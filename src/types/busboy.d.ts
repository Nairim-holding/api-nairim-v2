declare module 'busboy' {
  import { Writable, Readable } from 'stream';
  import { IncomingHttpHeaders } from 'http';

  interface BusboyConfig {
    headers: IncomingHttpHeaders;
    limits?: {
      fieldNameSize?: number;
      fieldSize?: number;
      fields?: number;
      fileSize?: number;
      files?: number;
      parts?: number;
      headerPairs?: number;
    };
    preservePath?: boolean;
  }

  interface FileInfo {
    filename: string;
    encoding: string;
    mimeType: string;
  }

  interface FieldInfo {
    nameTruncated: boolean;
    valueTruncated: boolean;
    encoding: string;
    mimeType: string;
  }

  interface BusboyEvents {
    on(event: 'field', listener: (name: string, value: string, info: FieldInfo) => void): this;
    on(event: 'file', listener: (name: string, stream: Readable, info: FileInfo) => void): this;
    on(event: 'finish', listener: () => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  type Busboy = Writable & BusboyEvents;

  function busboy(options: BusboyConfig): Busboy;
  export = busboy;
}
