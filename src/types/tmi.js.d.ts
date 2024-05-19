declare module 'tmi.js' {
    export interface Client {
      connect(): Promise<void>;
      on(event: 'message', callback: (channel: string, tags: ChatUserstate, message: string, self: boolean) => void): void;
      on(event: 'connected', callback: (address: string, port: number) => void): void;
      addListener(event: 'message', callback: (channel: string, tags: ChatUserstate, message: string, self: boolean) => void): void;
      addListener(event: 'connected', callback: (address: string, port: number) => void): void;
    }
  
    export interface Options {
      options?: {
        debug?: boolean;
      };
      connection?: {
        reconnect?: boolean;
        secure?: boolean;
      };
      identity?: {
        username: string;
        password: string;
      };
      channels: string[];
    }
  
    export interface ChatUserstate {
      username?: string;
      'display-name'?: string;
    }
  
    export function Client(options: Options): Client;
  }
  