import { openDB, deleteDB } from 'idb';

const DB_NAME = 'DisasterNetDB';
const STORE_NAME = 'messages';

export const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('synced', 'synced');
      }
    },
  });
};

export const saveSOS = async (packet: any) => {
  const db = await initDB();
  await db.put(STORE_NAME, { 
    synced: false, 
    ...packet, 
    db_timestamp: Date.now() 
  });
};

export const deleteSOS = async (id: string) => {
  const db = await initDB();
  await db.delete(STORE_NAME, id);
};

export const getAllSOS = async () => {
  const db = await initDB();
  return await db.getAll(STORE_NAME);
};

export const resetLocalDatabase = async () => {
  await deleteDB(DB_NAME);
  console.log("[SYSTEM] Local Database Wiped.");
};
