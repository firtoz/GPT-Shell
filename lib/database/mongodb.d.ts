import { ChangeStreamDocument, Collection, Document, Filter, FindOptions } from 'mongodb';
export type KeyValuePair<T = any> = {
    key: string;
    value: T;
};
export declare class KeyValueDB {
    private readonly client;
    collection: Collection<KeyValuePair> | null;
    constructor();
    initialise(): Promise<boolean>;
    close(): Promise<boolean>;
    get<T = any>(key: string): Promise<T | null>;
    set(key: string, value: any): Promise<void>;
    getAndWatch(key: string, callback: (value: string | null) => void): Promise<void>;
    watchKey(key: string, callback: (doc: ChangeStreamDocument<KeyValuePair>) => void): void;
    find(filter: Filter<KeyValuePair>, options?: FindOptions<Document>): import("mongodb").FindCursor<import("mongodb").WithId<KeyValuePair<any>>>;
}
