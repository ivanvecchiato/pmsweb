import fs from 'fs';
import { FieldValue } from 'firebase-admin/firestore';
import path from 'path';
import { getFireDb } from '../../modules/firestore.js';
import { databaseRoot } from '../../modules/dbPaths.js';
import configs from '../../modules/configs.js';
import printf from '../../fiscalprinter/printf.js';
import repo from '../repo.js';
import db from '../../hotel/modules/db.js';
import log from '../../modules/log.js';
import { commitHotelReservation, getHotelReservationVersion } from './reservationSync.js';
import { hotelCloudSyncEnabled } from './hotelCloudSync.js';

const journalPath = path.join(databaseRoot, 'hotel', 'cloud-fiscal-jobs.json');
let journal = {};
let processing = false;
let timer = null;
let unsubscribe = null;
if (hotelCloudSyncEnabled && fs.existsSync(journalPath)) journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));

function saveJournal() {
   fs.mkdirSync(path.dirname(journalPath), { recursive: true });
   fs.writeFileSync(`${journalPath}.tmp`, JSON.stringify(journal, null, 2));
   fs.renameSync(`${journalPath}.tmp`, journalPath);
}

async function processHotelFiscalJobs() {
   if (!hotelCloudSyncEnabled || processing) return;
   processing = true;
   try {
      const firedb = getFireDb();
      const interrupted = await firedb.collection('pms_fiscal_jobs').where('status', '==', 'processing').get();
      for (const job of interrupted.docs) {
         if (!journal[job.id] && job.data().claimed_at?.toMillis() > Date.now() - 300000) continue;
         const document = await db.hotelAccountDocumentDB.findOne({ fiscal_job_id: job.id });
         let result = journal[job.id]?.result;
         if (document) result = { state: 'issued', documentId: document.id, progressivo: document.progressivo, chiusura: document.chiusura, timestamp: document.timestamp };
         if (!result) result = { state: 'uncertain', error: 'Processo interrotto: verificare il documento sulla stampante prima di riprovare' };
         await commitHotelReservation(firedb, { documentId: job.data().reservation_id, type: 'fiscal', baseRevision: 0, source: 'fiscal', jobId: job.id, result, operator: job.data().operator });
         journal[job.id] = { phase: result.state === 'issued' ? 'completed' : 'uncertain', result };
         saveJournal();
      }
      const pending = await firedb.collection('pms_fiscal_jobs').where('status', '==', 'pending').get();
      for (const job of pending.docs) {
         const local = await db.reservationDB.findOne(item => String(item.id) === job.data().reservation_id);
         if (!local) continue;
         const printer = configs.getConfigs('hotelFiscalPrinter');
         if (!printer?.address) return;
         printf.address = printer.address + (printer.port ? `:${printer.port}` : '');
         const status = await new Promise(resolve => printf.getStatus(resolve));
         const state = status?.data?.Service?.Request;
         if (status?.result !== 'ok' || !state || String(state.errorCode) !== '0' || ['printerError', 'paperEnd', 'coverOpen', 'busy'].some(field => String(state[field]) === '1')) return;
         const claimed = await firedb.runTransaction(async transaction => {
            const current = await transaction.get(job.ref);
            const canonical = await getHotelReservationVersion(firedb, job.data().reservation_id, transaction);
            const reservation = canonical.current;
            const deposit = reservation?.deposits.find(item => item.id === job.data().deposit_id);
            const requested = canonical.depositDocuments.get(job.data().deposit_id)?.data.fiscal_requested === true;
            if (current.data()?.status !== 'pending') return null;
            if (reservation?.revision !== local.revision) return null;
            if (!reservation || !deposit || !requested || deposit.annulled || deposit.document_id) {
               transaction.update(job.ref, { status: 'cancelled' });
               return null;
            }
            transaction.update(job.ref, { status: 'processing', claimed_at: FieldValue.serverTimestamp() });
            return { reservation, deposit };
         });
         if (!claimed) continue;
         journal[job.id] = { phase: 'sending' };
         saveJournal();
         let printed;
         try {
            printed = await repo.printHotelDepositFiscal({ reservationId: claimed.reservation.id, deposit: claimed.deposit, operator: job.data().operator }, job.id, claimed.reservation);
         } catch (error) {
            printed = { success: false, error: error.message };
         }
         const result = printed?.success
            ? { state: 'issued', documentId: printed.documentId, progressivo: printed.progressivo, chiusura: printed.chiusura, timestamp: printed.timestamp }
            : { state: 'uncertain', error: printed?.error || 'Esito stampa incerto: verificare prima di riprovare' };
         journal[job.id] = { phase: result.state === 'issued' ? 'printed' : 'uncertain', result };
         saveJournal();
         await commitHotelReservation(firedb, { documentId: claimed.reservation.id, type: 'fiscal', baseRevision: 0, source: 'fiscal', jobId: job.id, result, operator: job.data().operator });
         journal[job.id].phase = result.state === 'issued' ? 'completed' : 'uncertain';
         saveJournal();
      }
   } catch (error) {
      log.e(`Hotel fiscal jobs: ${error.message}`);
   } finally {
      processing = false;
   }
}

function startHotelFiscalJobs() {
   if (!hotelCloudSyncEnabled || unsubscribe) return;
   unsubscribe = getFireDb().collection('pms_fiscal_jobs').where('status', '==', 'pending').onSnapshot(() => { void processHotelFiscalJobs(); }, error => log.e(`Hotel fiscal jobs listener: ${error.message}`));
   timer = setInterval(() => { void processHotelFiscalJobs(); }, 5000);
   timer.unref();
}

function stopHotelFiscalJobs() {
   if (unsubscribe) unsubscribe();
   if (timer) clearInterval(timer);
   unsubscribe = null;
   timer = null;
}

export { processHotelFiscalJobs, startHotelFiscalJobs, stopHotelFiscalJobs };
