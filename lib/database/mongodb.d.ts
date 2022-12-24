import { ChangeStreamDocument, Document, Filter, FindOptions } from 'mongodb';
type KeyValuePair = {
    key: string;
    value: any;
};
export declare class KeyValueDB {
    private readonly client;
    private collection;
    constructor();
    initialise(): Promise<boolean>;
    close(): Promise<boolean>;
    get<T = any>(key: string): Promise<T | null>;
    set(key: string, value: any): Promise<void>;
    getAndWatch(key: string, callback: (value: string | null) => void): Promise<void>;
    watchKey(key: string, callback: (doc: ChangeStreamDocument<KeyValuePair>) => void): void;
    find(filter: Filter<KeyValuePair>, options?: FindOptions<Document>): import("mongodb").FindCursor<import("mongodb").WithId<KeyValuePair>>;
}
export {};
