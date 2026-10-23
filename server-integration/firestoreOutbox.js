import fs from 'fs';
import path from 'path';
import { getFireDb } from './firestore.js';
import log from './log.js';
import { databaseRoot } from './dbPaths.js';
import { hotelCloudSyncEnabled, publishHotelReservation } from '../pms/modules/hotelCloudSync.js';

const outboxPath = path.join(databaseRoot, 'firestore-outbox.json');
const outboxTempPath = path.join(databaseRoot, 'firestore-outbox.tmp.json');
const retryableErrors = ['DEADLINE_EXCEEDED', 'UNAVAILABLE', 'ABORTED', 'RESOURCE_EXHAUSTED'];

var operations = [];
var processing = false;
var processorInterval = null;

function loadOutbox() {
  try {
    if (!fs.existsSync(outboxPath)) {
      operations = [];
      return;
    }

    const parsed = JSON.parse(fs.readFileSync(outboxPath, 'utf8'));
    operations = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    log.e('firestore outbox load error: ' + error.message);
    operations = [];
  }
}

function saveOutbox() {
  fs.mkdirSync(path.dirname(outboxPath), { recursive: true });
  fs.writeFileSync(outboxTempPath, JSON.stringify(operations, null, 2));
  fs.renameSync(outboxTempPath, outboxPath);
}

function operationKey(collection, documentId) {
  return `${collection}/${documentId}`;
}

function hasPendingFirestoreOperation(collection, documentId) {
  return operations.some(item => item.key === operationKey(collection, documentId));
}

async function enqueueSet(collection, documentId, payload, merge = true) {
  const key = operationKey(collection, documentId);
  const existingIndex = operations.findIndex(item => item.key === key);
  const operation = {
    key,
    type: 'set',
    collection,
    documentId: String(documentId),
    payload,
    merge,
    attempts: 0,
    nextAttemptAt: 0,
    updatedAt: Math.max(Date.now(), Number(operations[existingIndex]?.updatedAt || 0) + 1)
  };

  if (hotelCloudSyncEnabled && collection === 'pms_hotel_reservations') {
    operation.baseRevision = payload.revision ?? 0;
  }

  if (existingIndex === -1) {
    operations.push(operation);
  } else {
    operations[existingIndex] = operation;
  }

  saveOutbox();
  void processOutbox();
}

async function enqueueDelete(collection, documentId, baseRevision = 0) {
  const key = operationKey(collection, documentId);
  const existingIndex = operations.findIndex(item => item.key === key);
  const operation = {
    key,
    type: 'delete',
    collection,
    documentId: String(documentId),
    attempts: 0,
    nextAttemptAt: 0,
    updatedAt: Math.max(Date.now(), Number(operations[existingIndex]?.updatedAt || 0) + 1)
  };

  if (hotelCloudSyncEnabled && collection === 'pms_hotel_reservations') {
    operation.baseRevision = baseRevision;
  }

  if (existingIndex === -1) {
    operations.push(operation);
  } else {
    operations[existingIndex] = operation;
  }

  saveOutbox();
  void processOutbox();
}

async function processOutbox() {
  if (processing || operations.length === 0) return;
  processing = true;

  try {
    while (operations.length > 0) {
      const operation = hotelCloudSyncEnabled
        ? operations.find(item => Number(item.nextAttemptAt || 0) <= Date.now())
        : operations[0];
      if (!operation || Number(operation.nextAttemptAt || 0) > Date.now()) break;

      try {
        const ref = getFireDb()
          .collection(operation.collection)
          .doc(String(operation.documentId));

        if (hotelCloudSyncEnabled && operation.collection === 'pms_hotel_reservations') {
          const result = await publishHotelReservation(operation);
          const pending = operations.find(item => item.key === operation.key && item.updatedAt !== operation.updatedAt);
          if (pending && pending.baseRevision === operation.baseRevision && result.operationRevision != null) {
            pending.baseRevision = result.operationRevision;
          }
        } else if (operation.type === 'delete') {
          await ref.delete();
        } else {
          await ref.set(operation.payload, { merge: operation.merge !== false });
        }

        const completedIndex = operations.findIndex(item =>
          item.key === operation.key
          && item.updatedAt === operation.updatedAt
        );
        if (completedIndex !== -1) {
          operations.splice(completedIndex, 1);
        }
        saveOutbox();
      } catch (error) {
        const text = String(error?.code || error?.message || '').toUpperCase();
        const retryable = retryableErrors.some(code => text.includes(code));
        operation.attempts = Number(operation.attempts || 0) + 1;
        operation.lastError = String(error?.message || error);
        operation.nextAttemptAt = retryable
          ? Date.now() + Math.min(60000, 1000 * Math.pow(2, Math.min(operation.attempts, 6)))
          : Date.now() + 60 * 60 * 1000;
        saveOutbox();
        log.e(`firestore outbox ${operation.collection}/${operation.documentId} error: ${operation.lastError}`);
        break;
      }
    }
  } finally {
    processing = false;
  }
}

function startOutboxProcessor() {
  if (processorInterval != null) return;
  loadOutbox();
  void processOutbox();
  processorInterval = setInterval(() => {
    void processOutbox();
  }, 5000);
  log.d('firestore outbox processor started: ' + operations.length + ' pending');
}

loadOutbox();

export {
  enqueueSet,
  enqueueDelete,
  hasPendingFirestoreOperation,
  processOutbox,
  startOutboxProcessor
};
