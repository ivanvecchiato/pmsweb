import { collection, collectionGroup, doc, getDocFromServer, getDocsFromServer, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { prepareHotelReservation } from './hotelReservation.js'

export async function reservationHash(value) {
  if (value == null) return null
  const { revision, ...content } = value
  const json = JSON.stringify(content, (key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]])) : item)
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json))), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function readHotelDeposits(db, id) {
  const snapshot = await getDocsFromServer(collection(db, 'pms_hotel_reservations', id, 'deposits'))
  return snapshot.docs.sort((left, right) => left.data().position - right.data().position).map(entry => {
    const { position, reservation_revision, ...deposit } = entry.data()
    return deposit
  })
}

async function getHotelReservationVersion(db, id, transaction) {
  const [current, deleted] = await Promise.all([
    transaction.get(doc(db, 'pms_hotel_reservations', id)),
    transaction.get(doc(db, 'pms_hotel_reservation_tombstones', id))
  ])
  if (current.exists() && deleted.exists()) throw Error('Prenotazione e cancellazione entrambe correnti')
  const revision = current.exists() ? current.data().revision : deleted.exists() ? deleted.data().revision : 0
  const depositSnapshot = await getDocsFromServer(collection(db, 'pms_hotel_reservations', id, 'deposits'))
  const deposits = new Map()
  for (const entry of depositSnapshot.docs.sort((left, right) => left.data().position - right.data().position)) {
    const snapshot = await transaction.get(entry.ref)
    if (!snapshot.exists()) throw Error('Acconto modificato durante la lettura')
    const { fiscal_requested, position, reservation_revision, ...financial } = snapshot.data()
    deposits.set(entry.id, { ref: entry.ref, data: snapshot.data(), financial })
  }
  const reservation = current.exists() ? { ...current.data(), deposits: [...deposits.values()].map(entry => entry.financial) } : null
  if (revision) {
    const version = await transaction.get(doc(db, 'pms_hotel_reservation_versions', id, 'revisions', String(revision)))
    if (!Number.isSafeInteger(revision) || !version.exists() || version.data().revision !== revision
      || await reservationHash(version.data().snapshot) !== await reservationHash(reservation)) throw Error('Versione corrente non confermata nello storico')
  }
  return { current: reservation, revision, deposits }
}

export async function executeHotelOperation(db, user, path, input) {
  if (!user) throw Object.assign(Error('Accesso cloud richiesto'), { status: 401 })
  const data = JSON.parse(JSON.stringify(input || {}))
  const profileSnapshot = await getDocFromServer(doc(db, 'pms_web_users', user.uid))
  const profile = profileSnapshot.data()
  if (!profile || !profile.enabled || profile.operatorId == null || !['admin', 'staff'].includes(profile.role)
    || !(profile.role === 'admin' || profile.permissions?.customers === true)) throw Object.assign(Error('Operatore non autorizzato'), { status: 403 })
  if (path === '/conflicts') {
    const snapshot = await getDocsFromServer(query(collectionGroup(db, 'proposals'), where('status', '==', 'pending')))
    return Promise.all(snapshot.docs.map(async entry => {
      const id = entry.ref.parent.parent.id
      const [current, deleted] = await Promise.all([getDocFromServer(doc(db, 'pms_hotel_reservations', id)), getDocFromServer(doc(db, 'pms_hotel_reservation_tombstones', id))])
      return { id, proposalId: entry.id, ...entry.data(), current: current.exists() ? { ...current.data(), deposits: await readHotelDeposits(db, id) } : null, currentRevision: current.exists() ? current.data().revision : deleted.exists() ? deleted.data().revision : 0 }
    }))
  }
  const actions = { '/new_reservation': 'create', '/newreservation': 'create', '/update_reservation': 'update', '/updatereservation': 'update', '/cancel_reservation': 'cancel', '/delete_reservation': 'delete', '/resolve_conflict': 'resolve', '/deposit/request_fiscal': 'request_fiscal' }
  const action = actions[path]
  if (!action) throw Error('Operazione cloud non disponibile')
  const id = data.id
  const expected = data.baseRevision
  if (typeof id !== 'string' || !/^[A-Za-z0-9_.:-]{1,128}$/.test(id) || !Number.isSafeInteger(expected) || expected < 0) throw Error('Identificativo o revisione non validi')
  if (action === 'create' && expected !== 0) throw Error('Nuova prenotazione con revisione non valida')
  const resolving = action === 'resolve'
  if (resolving && (!data.proposalId || !['proposal', 'current'].includes(data.choice))) throw Error('Risoluzione obbligatoria')
  const operationId = resolving ? `resolve-${data.proposalId}-${expected}` : `${expected}-${await reservationHash(data)}`
  let result
  for (let attempt = 0; attempt < 5; attempt++) {
    let attemptedGuards = []
    try {
      result = await runTransaction(db, async transaction => {
        const [profileNow, config] = await Promise.all([
          transaction.get(profileSnapshot.ref), transaction.get(doc(db, 'pms_configs', 'current'))
        ])
        const currentProfile = profileNow.data()
        if (!currentProfile || !currentProfile.enabled || currentProfile.operatorId == null
          || !['admin', 'staff'].includes(currentProfile.role)
          || !(currentProfile.role === 'admin' || currentProfile.permissions?.customers === true)) throw Object.assign(Error('Operatore non autorizzato'), { status: 403 })
        const canonical = await getHotelReservationVersion(db, id, transaction)
        const proposalId = resolving ? data.proposalId : operationId
        const proposalRef = doc(db, 'pms_hotel_reservation_conflicts', id, 'proposals', proposalId)
        const [proposal, acknowledged] = await Promise.all([
          transaction.get(proposalRef), transaction.get(doc(db, 'pms_hotel_reservation_versions', id, 'revisions', String(expected + 1)))
        ])
        if (resolving && !proposal.exists()) throw Error('Proposta di conflitto non trovata')
        if (resolving && proposal.data().status === 'resolved') {
          if (proposal.data().resolution_choice !== data.choice) throw Error('Proposta già risolta con una decisione diversa')
          return { ...canonical, status: 'already_committed' }
        }
        if (acknowledged.exists() && acknowledged.data().operation_id === operationId) return { ...canonical, status: 'already_committed' }
        if (!['create', 'resolve'].includes(action) && !canonical.current) throw Error('Prenotazione non trovata')
        if (action === 'delete' && canonical.current?.deposits.length) throw Error('Prenotazione con acconti: annullare senza eliminare i dati contabili')
        const [rooms, rates, timeTable] = await Promise.all([
          getDocsFromServer(collection(db, 'rooms')), getDocsFromServer(collection(db, 'pms_hotel_rates')), getDocsFromServer(collection(db, 'pms_hotel_timetable'))
        ])
        // Le letture documento collegano i parametri usati al tentativo transazionale corrente.
        const pricingSnapshots = await Promise.all([...rooms.docs, ...rates.docs, ...timeTable.docs].map(entry => transaction.get(entry.ref)))
        if (pricingSnapshots.some(entry => !entry.exists())) throw Error('Parametri hotel modificati: ripetere il salvataggio')
        const jobs = new Map()
        const depositIds = new Set([...canonical.deposits.keys(), ...(data.deposits || []).map(entry => entry.id), ...(resolving ? proposal.data().snapshot?.deposits || [] : []).map(entry => entry.id)])
        for (const depositId of depositIds) {
          const snapshot = await transaction.get(doc(db, 'pms_fiscal_jobs', `${id}_${depositId}`))
          jobs.set(depositId, snapshot.data())
        }
        const context = {
          canOverridePricingPolicy: currentProfile.role === 'admin' || currentProfile.permissions?.override_pricing_policy === true,
          config: config.data(), rooms: pricingSnapshots.slice(0, rooms.size).map(entry => entry.data()),
          rates: pricingSnapshots.slice(rooms.size, rooms.size + rates.size).map(entry => entry.data()),
          timeTable: pricingSnapshots.slice(rooms.size + rates.size).map(entry => entry.data()), fiscalJobs: jobs
        }
        let base = canonical.current
        if (expected && expected !== canonical.revision) base = (await transaction.get(doc(db, 'pms_hotel_reservation_versions', id, 'revisions', String(expected)))).data()?.snapshot
        let selected = action === 'delete' ? null : action === 'request_fiscal' ? canonical.current
          : resolving ? (data.choice === 'proposal' ? proposal.data().snapshot : canonical.current)
            : await prepareHotelReservation(context, { documentId: id, action, payload: data, operator: currentProfile.operatorId }, base)
        if (resolving && selected) selected = await prepareHotelReservation(context, { documentId: id, action: selected.status === -100 ? 'cancel' : 'update', payload: { ...selected, recalculatePricing: true }, operator: currentProfile.operatorId }, canonical.current)
        const conflict = (reason, conflictingReservationId) => {
          if (!proposal.exists() && !resolving) transaction.set(proposalRef, {
            base_revision: expected, snapshot: selected, status: 'pending', authoritative_revision_at_detection: canonical.revision,
            source: 'cloud', operator: currentProfile.operatorId, uid: user.uid, created_at: serverTimestamp(),
            ...(reason ? { reason, conflicting_reservation_id: conflictingReservationId } : {})
          })
          return { ...canonical, status: 'conflict', proposalId, ...(reason ? { reason } : {}) }
        }
        if (expected !== canonical.revision) return conflict()
        const guards = []
        for (const roomId of new Set([canonical.current?.roomId, selected?.roomId].filter(Boolean))) {
          const ref = doc(db, 'pms_room_inventory', String(roomId))
          const snapshot = await transaction.get(ref)
          guards.push({ ref, revision: snapshot.exists() ? snapshot.data().revision : 0 })
        }
        attemptedGuards = guards
        if (selected && Number(selected.status) !== -100 && String(selected.roomType).toLowerCase() !== 'over') {
          // Le query Web non sono letture transazionali: il guard letto prima della query
          // viene aggiornato nello stesso commit da ogni scrittore, compreso il server.
          const occupied = await getDocsFromServer(query(collection(db, 'pms_hotel_reservations'), where('roomId', '==', String(selected.roomId))))
          const conflicting = occupied.docs.find(entry => entry.id !== id && Number(entry.data().status) !== -100 && entry.data().checkin < selected.checkout && entry.data().checkout > selected.checkin)
          if (conflicting) return conflict('room_occupied', conflicting.id)
        }
        if (action === 'request_fiscal') {
          const deposit = canonical.deposits.get(data.depositId)
          if (!deposit || deposit.financial.annulled || deposit.financial.fiscal_status !== 'pending') throw Error('Acconto non disponibile per emissione fiscale')
          if (deposit.data.fiscal_requested) return { ...canonical, status: 'already_committed' }
        }
        const revision = canonical.revision + 1
        const current = selected ? { ...selected, revision } : null
        for (const guard of guards) transaction.set(guard.ref, { revision: guard.revision + 1 })
        for (const [position, deposit] of (current?.deposits || []).entries()) {
          const previous = canonical.deposits.get(deposit.id)
          const requested = previous?.data.fiscal_requested === true || (action === 'request_fiscal' && deposit.id === data.depositId)
          transaction.set(doc(db, 'pms_hotel_reservations', id, 'deposits', deposit.id), { ...deposit, position, reservation_revision: revision, fiscal_requested: requested })
          const job = jobs.get(deposit.id)
          if (requested && !['external', 'historical', 'issued'].includes(deposit.fiscal_status) && !['processing', 'uncertain', 'completed'].includes(job?.status)) transaction.set(doc(db, 'pms_fiscal_jobs', `${id}_${deposit.id}`), {
            reservation_id: id, deposit_id: deposit.id, type: 'deposit', status: deposit.annulled ? 'cancelled' : 'pending', operator: currentProfile.operatorId, updated_at: serverTimestamp()
          })
        }
        if (canonical.current) transaction.set(doc(db, 'pms_hotel_reservation_history', `sync_${id}_${revision}`), {
          id: `sync_${id}_${revision}`, reservation_id: id, modified_timestamp: Date.now(), modified_at: new Date().toISOString(),
          revision, source: 'cloud', operator: { id: currentProfile.operatorId }, snapshot: canonical.current
        })
        transaction.set(doc(db, 'pms_hotel_reservation_versions', id, 'revisions', String(revision)), {
          revision, snapshot: current, operation_id: operationId, source: resolving ? 'resolution' : 'cloud', operator: currentProfile.operatorId,
          uid: user.uid, committed_at: serverTimestamp(), ...(resolving ? { proposal_id: proposalId, choice: data.choice } : {})
        })
        if (current) {
          const { deposits, ...booking } = current
          transaction.set(doc(db, 'pms_hotel_reservations', id), booking)
          transaction.delete(doc(db, 'pms_hotel_reservation_tombstones', id))
        } else {
          transaction.delete(doc(db, 'pms_hotel_reservations', id))
          transaction.set(doc(db, 'pms_hotel_reservation_tombstones', id), { id, revision, deleted_at: serverTimestamp() })
        }
        if (resolving) transaction.update(proposalRef, { status: 'resolved', resolution_revision: revision, resolution_choice: data.choice, resolved_by: currentProfile.operatorId, resolved_at: serverTimestamp() })
        return { current, revision, status: 'committed' }
      })
      break
    } catch (error) {
      // Le Rules possono respingere un contatore diventato obsoleto prima del controllo
      // delle precondizioni: ripetere solo se un guard letto è effettivamente cambiato.
      if (error.code !== 'permission-denied' || attempt === 4) throw error
      const latest = await Promise.all(attemptedGuards.map(guard => getDocFromServer(guard.ref)))
      if (!latest.some((snapshot, index) => (snapshot.exists() ? snapshot.data().revision : 0) !== attemptedGuards[index].revision)) throw error
    }
  }
  if (result.status === 'conflict') throw Object.assign(Error(result.reason === 'room_occupied' ? 'Camera già occupata nel periodo richiesto' : 'La prenotazione è stata modificata da un altro operatore'), {
    status: 409, result: { error: 'La prenotazione è stata modificata da un altro operatore', ...result, deposits: undefined }
  })
  return { success: true, id, reservation: result.current, revision: result.revision, ...(action === 'cancel' ? result.current : {}) }
}
