import {ChangeStreamDocument, Collection, Document, Filter, FindOptions, MongoClient, ServerApiVersion} from 'mongodb';
import {getEnv} from "../utils/GetEnv";

const MONGODB_URI = getEnv('MONGODB_URI');
const DB_NAME = getEnv('DB_NAME');

export type KeyValuePair<T = any> = { key: string, value: T };

export class KeyValueDB {
    private readonly client: MongoClient | null = null;
    public collection: Collection<KeyValuePair> | null = null;

    constructor() {
        if (MONGODB_URI == null || DB_NAME == null) {
            return;
        }

        this.client = new MongoClient(MONGODB_URI, {
            serverApi: ServerApiVersion.v1
        });
    }

    async initialise() {
        if (this.client == null || DB_NAME == null) {
            return false;
        }

        await this.client.connect();
        const database = this.client.db(DB_NAME);
        this.collection = database.collection('STORAGE');

        return true;
    }

    async close() {
        if (this.client == null || DB_NAME == null) {
            return false;
        }

        await this.client.close();

        return true;
    }

    async get<T = any>(key: string): Promise<T | null> {
        if (this.collection == null) {
            throw new Error('No connection.');
        }

        const doc = await this.collection.findOne({key});
        if (doc == null) {
            return null;
        }

        return doc.value;
    }

    async set(key: string, value: any): Promise<void> {
        if (this.collection == null) {
            throw new Error('No connection.');
        }

        await this.collection.updateOne(
            {key: key},
            {
                $set: {
                    value,
                }
            },
            {upsert: true}
        );
    }

    async getAndWatch(key: string, callback: (value: string | null) => void) {
        callback(await this.get(key));

        this.watchKey(key, async () => {
            console.log(`${key} changed!`)
            callback(await this.get(key));
        });
    }

    watchKey(key: string, callback: (doc: ChangeStreamDocument<KeyValuePair>) => void) {
        if (this.collection == null) {
            throw new Error('No connection.');
        }

        const collection = this.collection;

        // Use the `watch()` method to specify a pipeline of changes to be monitored on the collection
        const pipeline = [{$match: {'fullDocument.key': key}}];
        const changeStream = collection.watch(pipeline, {
            fullDocument: 'updateLookup',
        });

        // Listen for the "change" event on the change stream, and call the callback function whenever a change is detected
        changeStream.on('change', (change) => {
            callback(change);
        });
    }

     find(filter: Filter<KeyValuePair>, options?: FindOptions<Document>) {
        if(this.collection == null) {
            throw new Error('No connection!');
        }

        return this.collection.find(filter, options);
    }
}
