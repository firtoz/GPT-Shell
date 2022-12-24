"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyValueDB = void 0;
const mongodb_1 = require("mongodb");
const GetEnv_1 = require("../utils/GetEnv");
const MONGODB_URI = (0, GetEnv_1.getEnv)('MONGODB_URI');
const DB_NAME = (0, GetEnv_1.getEnv)('DB_NAME');
class KeyValueDB {
    client = null;
    collection = null;
    constructor() {
        if (MONGODB_URI == null || DB_NAME == null) {
            return;
        }
        this.client = new mongodb_1.MongoClient(MONGODB_URI, {
            serverApi: mongodb_1.ServerApiVersion.v1
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
    async get(key) {
        if (this.collection == null) {
            throw new Error('No connection.');
        }
        const doc = await this.collection.findOne({ key });
        if (doc == null) {
            return null;
        }
        return doc.value;
    }
    async set(key, value) {
        if (this.collection == null) {
            throw new Error('No connection.');
        }
        await this.collection.updateOne({ key: key }, {
            $set: {
                value,
            }
        }, { upsert: true });
    }
    async getAndWatch(key, callback) {
        callback(await this.get(key));
        this.watchKey(key, async () => {
            console.log(`${key} changed!`);
            callback(await this.get(key));
        });
    }
    watchKey(key, callback) {
        if (this.collection == null) {
            throw new Error('No connection.');
        }
        const collection = this.collection;
        // Use the `watch()` method to specify a pipeline of changes to be monitored on the collection
        const pipeline = [{ $match: { 'fullDocument.key': key } }];
        const changeStream = collection.watch(pipeline, {
            fullDocument: 'updateLookup',
        });
        // Listen for the "change" event on the change stream, and call the callback function whenever a change is detected
        changeStream.on('change', (change) => {
            callback(change);
        });
    }
    find(filter, options) {
        if (this.collection == null) {
            throw new Error('No connection!');
        }
        return this.collection.find(filter, options);
    }
}
exports.KeyValueDB = KeyValueDB;
//# sourceMappingURL=mongodb.js.map