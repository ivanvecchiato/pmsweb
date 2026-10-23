import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { prepareHotelReservation } from './hotel.js';

const collection = 'pms_hotel_reservations';
const tombstones = 'pms_hotel_reservation_tombstones';
const versions = 'pms_hotel_reservation_versions';
const proposals = 'pms_hotel_reservation_conflicts';

function reservationHash(value) {
   if (value == null) return null;
   const { revision, ...content } = value;
   const json = JSON.stringify(content, (key, item) => item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]])) : item);
   return createHash('sha256').update(json).digest('hex');
}

async function getHotelReservationVersion(firedb, id, transaction) {
   const [snapshot, deleted] = await transaction.getAll(
      firedb.collection(collection).doc(id),
      firedb.collection(tombstones).doc(id)
   );
   if (snapshot.exists && deleted.exists) throw new Error(`Prenotazione e cancellazione entrambe correnti: ${id}`);
   const current = snapshot.exists ? snapshot.data() : null;
   if (!snapshot.exists && !deleted.exists) {
      const history = await transaction.get(firedb.collection(versions).doc(id).collection('revisions').limit(1));
      if (!history.empty) throw new Error(`Stato corrente rimosso senza cancellazione revisionata: ${id}`);
      return { current: null, revision: 0, version: null };
   }
   const revision = (snapshot.exists ? current : deleted.data()).revision;
   if (!Number.isSafeInteger(revision) || revision < 1) throw new Error(`Revisione hotel mancante o non valida: ${id}`);
   const version = await transaction.get(firedb.collection(versions).doc(id).collection('revisions').doc(String(revision)));
   if (!version.exists || version.data().revision !== revision || reservationHash(version.data().snapshot) !== reservationHash(current)
      || (current && current.revision !== version.data().snapshot?.revision)) {
      throw new Error(`Versione hotel corrente non confermata nello storico: ${id}/${revision}`);
   }
   return { current, revision, version: version.data() };
}

async function commitHotelReservation(firedb, operation) {
   const id = String(operation.documentId);
   const expected = operation.baseRevision;
   if (!['set', 'delete', 'resolve', 'fiscal'].includes(operation.type)) throw new Error('Operazione hotel non valida');
   if (!Number.isSafeInteger(expected) || expected < 0) throw new Error('Revisione di partenza obbligatoria');
   const resolving = operation.type === 'resolve';
   const fiscal = operation.type === 'fiscal';
   if (resolving && (!operation.proposalId || !['proposal', 'current'].includes(operation.choice) || operation.operator == null)) {
      throw new Error('Risoluzione e operatore obbligatori');
   }
   const payload = operation.type === 'delete' ? null : operation.payload;
   if (!resolving && !fiscal && operation.type !== 'delete' && (!payload || Array.isArray(payload) || String(payload.id) !== id)) throw new Error(`Hotel sync id non coerente: ${id}`);
   const operationId = fiscal ? `fiscal-${operation.jobId}-${operation.result?.state}` : resolving ? `resolve-${operation.proposalId}-${expected}` : `${expected}-${reservationHash(payload) || 'deleted'}`;
   const result = await firedb.runTransaction(async transaction => {
      if (operation.uid) {
         const profile = await transaction.get(firedb.collection('pms_web_users').doc(operation.uid));
         if (!profile.exists || profile.data().enabled !== true || !(profile.data().role === 'admin' || profile.data().permissions?.customers === true)) throw new Error('Operatore non autorizzato');
         operation.operator = profile.data().operatorId;
      }
      const canonical = await getHotelReservationVersion(firedb, id, transaction);
      const expectedRevision = fiscal ? canonical.revision : expected;
      let fiscalJob;
      if (fiscal) {
         if (!operation.jobId || !['issued', 'uncertain'].includes(operation.result?.state)) throw new Error('Esito fiscale non valido');
         fiscalJob = await transaction.get(firedb.collection('pms_fiscal_jobs').doc(operation.jobId));
         if (!fiscalJob.exists || fiscalJob.data().reservation_id !== id) throw new Error('Operazione fiscale non trovata');
         if (fiscalJob.data().status === 'completed') return { ...canonical, status: 'already_committed' };
         if (!['processing', 'uncertain'].includes(fiscalJob.data().status) || !canonical.current) throw new Error('Stato fiscale non valido');
      }
      if (operation.action === 'create' && expected !== 0) throw new Error('Nuova prenotazione con revisione non valida');
      if (operation.action && !['create', 'quote', 'resolve'].includes(operation.action) && !canonical.current) throw new Error('Prenotazione non trovata');
      if (operation.uid && operation.type === 'delete' && canonical.current?.deposits?.some(deposit => !deposit.annulled)) throw new Error('Prenotazione con acconti: annullare senza eliminare i dati contabili');
      const proposalId = resolving ? operation.proposalId : operationId;
      const proposalRef = firedb.collection(proposals).doc(id).collection('proposals').doc(proposalId);
      const proposal = await transaction.get(proposalRef);
      const acknowledged = await transaction.get(firedb.collection(versions).doc(id).collection('revisions').doc(String(expectedRevision + 1)));
      if (resolving && !proposal.exists) throw new Error('Proposta di conflitto non trovata');
      if (resolving && proposal.data().status === 'resolved') {
         if (proposal.data().resolution_choice !== operation.choice) throw new Error('Proposta già risolta con una decisione diversa');
         return { ...canonical, status: 'already_committed', proposalId, proposalStatus: 'resolved' };
      }
      if (acknowledged.exists && acknowledged.data().operation_id === operationId) {
         return { ...canonical, status: 'already_committed', operationRevision: expectedRevision + 1 };
      }
      let prepared = payload;
      if (operation.source === 'cloud' && operation.action && !resolving && !fiscal && operation.type !== 'delete') {
         const base = expectedRevision === canonical.revision ? canonical.current
            : (expectedRevision ? (await transaction.get(firedb.collection(versions).doc(id).collection('revisions').doc(String(expectedRevision)))).data()?.snapshot : null);
         prepared = await prepareHotelReservation(firedb, transaction, operation, base);
      }
      if (canonical.revision !== expectedRevision) {
         if (!proposal.exists && !resolving) {
            transaction.create(proposalRef, {
               base_revision: expectedRevision, snapshot: prepared, status: 'pending',
               authoritative_revision_at_detection: canonical.revision,
               source: operation.source || 'local', operator: operation.operator ?? null,
               created_at: FieldValue.serverTimestamp()
            });
         }
         return { ...canonical, status: 'conflict', proposalId, proposalStatus: proposal.exists ? proposal.data().status : 'pending' };
      }
      let selected = resolving ? (operation.choice === 'proposal' ? proposal.data().snapshot : canonical.current) : prepared;
      if (resolving && selected && operation.validateInventory) selected = await prepareHotelReservation(firedb, transaction, { ...operation, action: selected.status === -100 ? 'cancel' : 'update', payload: { ...selected, recalculatePricing: true } }, canonical.current);
      const guards = [];
      if (operation.validateInventory) {
         for (const roomId of new Set([canonical.current?.roomId, selected?.roomId].filter(Boolean))) {
            const ref = firedb.collection('pms_room_inventory').doc(String(roomId));
            guards.push({ ref, snapshot: await transaction.get(ref) });
         }
         if (selected && Number(selected.status) !== -100 && String(selected.roomType).toLowerCase() !== 'over') {
            const occupied = await transaction.get(firedb.collection(collection).where('roomId', '==', String(selected.roomId)));
            const conflicting = occupied.docs.find(entry => entry.id !== id && Number(entry.data().status) !== -100
               && entry.data().checkin < selected.checkout && entry.data().checkout > selected.checkin);
            if (conflicting) {
               if (!proposal.exists && !resolving) transaction.create(proposalRef, {
                  base_revision: expectedRevision, snapshot: selected, status: 'pending', reason: 'room_occupied',
                  conflicting_reservation_id: conflicting.id, authoritative_revision_at_detection: canonical.revision,
                  source: operation.source || 'local', operator: operation.operator ?? null, created_at: FieldValue.serverTimestamp()
               });
               return { ...canonical, status: 'conflict', reason: 'room_occupied', proposalId, proposalStatus: 'pending' };
            }
         }
      }
      const fiscalJobs = [];
      if (operation.validateInventory && selected) {
         for (const deposit of selected.deposits || []) {
            if (!deposit.id || deposit.document_id || Number(deposit.invoice_progressive) > 0 || ['external', 'historical'].includes(deposit.fiscal_status)) continue;
            const ref = firedb.collection('pms_fiscal_jobs').doc(`${id}_${deposit.id}`);
            const job = await transaction.get(ref);
            fiscalJobs.push({ ref, deposit, existing: job.data() });
         }
      }
      if (fiscal) {
         selected = structuredClone(canonical.current);
         const deposit = selected.deposits.find(item => item.id === fiscalJob.data().deposit_id);
         if (!deposit) throw new Error('Acconto fiscale non trovato');
         if (operation.result.state === 'issued') {
            if (!operation.result.documentId || !Number.isInteger(operation.result.progressivo) || !Number.isInteger(operation.result.chiusura)) throw new Error('Riferimenti fiscali non validi');
            Object.assign(deposit, {
               fiscal_status: 'issued', document_id: operation.result.documentId, progressivo: operation.result.progressivo,
               chiusura: operation.result.chiusura, fiscal_timestamp: operation.result.timestamp
            });
         } else deposit.fiscal_status = 'uncertain';
      }
      const revision = canonical.revision + 1;
      const current = selected ? { ...selected, revision } : null;
      if (fiscal) transaction.update(fiscalJob.ref, {
         status: operation.result.state === 'issued' ? 'completed' : 'uncertain', result: operation.result,
         completed_revision: revision, updated_at: FieldValue.serverTimestamp()
      });
      for (const guard of guards) transaction.set(guard.ref, { revision: Number(guard.snapshot.data()?.revision || 0) + 1 });
      for (const { ref, deposit, existing } of fiscalJobs) {
         if (['processing', 'uncertain', 'completed'].includes(existing?.status)) continue;
         transaction.set(ref, {
            reservation_id: id, deposit_id: deposit.id, type: 'deposit', status: deposit.annulled ? 'cancelled' : 'pending',
            operator: operation.operator ?? null, updated_at: FieldValue.serverTimestamp()
         });
      }
      if (canonical.current) transaction.create(firedb.collection('pms_hotel_reservation_history').doc(`sync_${id}_${revision}`), {
         id: `sync_${id}_${revision}`, reservation_id: id, modified_timestamp: Date.now(), modified_at: new Date().toISOString(),
         revision, source: operation.source || 'local', operator: { id: operation.operator ?? null }, snapshot: canonical.current
      });
      transaction.create(firedb.collection(versions).doc(id).collection('revisions').doc(String(revision)), {
         revision, snapshot: current, operation_id: operationId,
         source: resolving ? 'resolution' : operation.source || 'local', operator: operation.operator ?? null,
         committed_at: FieldValue.serverTimestamp(),
         ...(resolving ? { proposal_id: proposalId, choice: operation.choice } : {})
      });
      if (current) {
         transaction.set(firedb.collection(collection).doc(id), current);
         transaction.delete(firedb.collection(tombstones).doc(id));
      } else {
         transaction.delete(firedb.collection(collection).doc(id));
         transaction.set(firedb.collection(tombstones).doc(id), { id, revision, deleted_at: FieldValue.serverTimestamp() });
      }
      if (resolving) transaction.update(proposalRef, {
         status: 'resolved', resolution_revision: revision, resolution_choice: operation.choice,
         resolved_by: operation.operator, resolved_at: FieldValue.serverTimestamp()
      });
      return { current, revision, status: 'committed', operationRevision: revision, ...(resolving ? { proposalId, proposalStatus: 'resolved' } : {}) };
   });

   return result;
}

export { reservationHash, getHotelReservationVersion, commitHotelReservation };
