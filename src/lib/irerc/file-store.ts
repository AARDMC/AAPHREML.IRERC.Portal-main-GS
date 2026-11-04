/**
 * Browser-side document store for the local React edition.
 *
 * Files are kept in IndexedDB (not localStorage) so the submission package is
 * available to every role in this browser. This is a single-browser store; a
 * shared multi-user deployment must replace it with server-side object storage.
 */
export type StoredDocument = {
  key: string;
  protocolId: string;
  code: string;
  version: number;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  uploadedAt: string;
};

import { REMOTE } from "./remote-flag";

const DB_NAME = "aaphreml-irerc-documents";
const STORE = "documents";
const VERSION = 1;

function keyFor(protocolId: string, code: string, version?: number): string {
  return version ? `${protocolId}:${code}:v${version}` : `${protocolId}:${code}`;
}

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Document storage is unavailable in this browser."));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open document storage."));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Document storage transaction failed."));
    tx.onabort = () => reject(tx.error ?? new Error("Document storage transaction was aborted."));
  });
}

export async function saveDocument(protocolId: string, code: string, file: File, version = 1): Promise<void> {
  if (REMOTE) {
    // Server assigns the version number and enforces access and size limits.
    const { uploadRemote } = await import("./remote");
    await uploadRemote(protocolId, code, file);
    return;
  }
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const record: StoredDocument = {
    key: keyFor(protocolId, code),
    protocolId,
    code,
    version,
    name: file.name,
    type: file.type,
    size: file.size,
    blob: file,
    uploadedAt: new Date().toISOString(),
  };
  const store = tx.objectStore(STORE);
  store.put(record);
  store.put({ ...record, key: keyFor(protocolId, code, version) });
  await transactionDone(tx);
  db.close();
}

export async function hasDocument(protocolId: string, code: string): Promise<boolean> {
  // Server mode: access is checked when the file is opened, so just offer it.
  if (REMOTE) return Boolean(protocolId && code);
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const request = tx.objectStore(STORE).getKey(keyFor(protocolId, code));
  const exists = await new Promise<boolean>((resolve, reject) => {
    request.onsuccess = () => resolve(Boolean(request.result));
    request.onerror = () => reject(request.error ?? new Error("Could not read document storage."));
  });
  db.close();
  return exists;
}

export async function getDocument(protocolId: string, code: string, version?: number): Promise<StoredDocument | null> {
  if (REMOTE) {
    try {
      const { fetchRemoteDocument } = await import("./remote");
      const doc = await fetchRemoteDocument(protocolId, code, version);
      return {
        key: `${protocolId}:${code}${version ? `:v${version}` : ""}`,
        protocolId,
        code,
        version: version ?? 0,
        name: doc.name,
        type: doc.mime,
        size: doc.blob.size,
        blob: doc.blob,
        uploadedAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const request = tx.objectStore(STORE).get(keyFor(protocolId, code, version));
  const record = await new Promise<StoredDocument | undefined>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as StoredDocument | undefined);
    request.onerror = () => reject(request.error ?? new Error("Could not read document storage."));
  });
  db.close();
  return record ?? null;
}

export async function deleteDocument(protocolId: string, code: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(keyFor(protocolId, code));
  await transactionDone(tx);
  db.close();
}

export async function openDocument(protocolId: string, code: string, version?: number): Promise<void> {
  const record = await getDocument(protocolId, code, version);
  if (!record) throw new Error("The document is not available in this browser.");
  const url = URL.createObjectURL(record.blob);
  const opened = window.open(url, "_blank");
  if (!opened) {
    downloadUrl(url, record.name);
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadDocument(protocolId: string, code: string, version?: number): Promise<void> {
  const record = await getDocument(protocolId, code, version);
  if (!record) throw new Error("The document is not available in this browser.");
  const url = URL.createObjectURL(record.blob);
  downloadUrl(url, record.name);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function downloadUrl(url: string, name: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = name || "document";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
