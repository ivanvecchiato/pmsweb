<template>
  <Teleport to="body" :disabled="embedded">
    <div v-if="open" class="modal-overlay" :class="{ 'modal-overlay-embedded': embedded }" @click="embedded ? null : closeDialog()">
      <form class="modal-content" :class="{ 'modal-content-embedded': embedded }" @click.stop @submit.prevent="submitForm">
        <div class="modal-header">
          <h2 class="modal-title">{{ title }}</h2>
          <button type="button" class="btn-close" aria-label="Chiudi" @click="closeDialog">×</button>
        </div>

        <div class="dialog-tabs" role="tablist" aria-label="Sezioni anagrafica cliente">
          <button
            type="button"
            class="dialog-tab"
            :class="{ active: activeTab === 'customer' }"
            role="tab"
            :aria-selected="activeTab === 'customer'"
            @click="activeTab = 'customer'"
          >
            Dati cliente
          </button>
          <button
            type="button"
            class="dialog-tab"
            :class="{ active: activeTab === 'other' }"
            role="tab"
            :aria-selected="activeTab === 'other'"
            @click="activeTab = 'other'"
          >
            Altro
          </button>
        </div>

        <div v-show="activeTab === 'customer'" class="modal-body" role="tabpanel">
          <div class="form-grid">
            <div class="form-group">
              <label class="input-label">Nome *</label>
              <input v-model="formData.firstname" type="text" class="input-field" placeholder="Mario" autocomplete="given-name" />
            </div>
            <div class="form-group">
              <label class="input-label">Cognome *</label>
              <input v-model="formData.lastname" type="text" class="input-field" placeholder="Rossi" autocomplete="family-name" />
            </div>
          </div>
          <div class="form-group">
              <label class="input-label">Email{{ requireContacts ? ' *' : '' }}</label>
            <input v-model="formData.email" type="email" class="input-field" placeholder="Email non disponibile" />
          </div>
          <div class="form-group">
              <label class="input-label">Telefono{{ requireContacts ? ' *' : '' }}</label>
            <input v-model="formData.phone" type="tel" class="input-field" placeholder="Telefono non disponibile" />
          </div>
          <div class="form-group">
            <label class="input-label">Città</label>
            <input v-model="formData.city" type="text" class="input-field" placeholder="Roma" />
          </div>
          <div class="form-group">
            <label class="input-label">Indirizzo</label>
            <input v-model="formData.address" type="text" class="input-field" placeholder="Via Roma 123" />
          </div>
          <div class="form-group">
            <label class="input-label">Note</label>
            <textarea v-model="formData.notes" class="textarea-field" rows="3" placeholder="Note aggiuntive sul cliente..."></textarea>
          </div>
        </div>

        <div v-show="activeTab === 'other'" class="modal-body" role="tabpanel">
          <p class="tab-description">Dati necessari per la registrazione dell’ospite e l’invio della schedina di notifica alla Pubblica Sicurezza.</p>

          <section class="form-section">
            <h3 class="section-title">Dati personali</h3>
            <div class="form-grid">
              <div class="form-group">
                <label class="input-label">Sesso</label>
                <select v-model="formData.sex" class="input-field">
                  <option value="">Seleziona</option>
                  <option value="M">Maschio</option>
                  <option value="F">Femmina</option>
                </select>
              </div>
              <div class="form-group">
                <label class="input-label">Tipo alloggiato</label>
                <select v-model="formData.guest_type" class="input-field">
                  <option value="">Seleziona</option>
                  <option value="16">Ospite singolo</option>
                  <option value="17">Capo famiglia</option>
                  <option value="18">Capo gruppo</option>
                  <option value="19">Familiare</option>
                  <option value="20">Membro gruppo</option>
                </select>
              </div>
            </div>
          </section>

          <section class="form-section">
            <h3 class="section-title">Nascita e cittadinanza</h3>
            <div class="form-grid">
              <div class="form-group">
                <label class="input-label">Data di nascita</label>
                <input v-model="formData.birth_date" type="date" class="input-field" />
              </div>
              <div class="form-group">
                <label class="input-label">Stato di nascita</label>
                <input v-model="formData.birth_state" type="text" class="input-field" placeholder="Italia" />
              </div>
              <div class="form-group">
                <label class="input-label">Comune di nascita</label>
                <input v-model="formData.birth_place" type="text" class="input-field" />
              </div>
              <div class="form-group">
                <label class="input-label">Provincia di nascita</label>
                <input v-model="formData.birth_district" type="text" class="input-field" maxlength="2" placeholder="RM" />
              </div>
              <div class="form-group form-group-full">
                <label class="input-label">Cittadinanza</label>
                <input v-model="formData.state" type="text" class="input-field" placeholder="Italia" />
              </div>
            </div>
          </section>

          <section class="form-section">
            <h3 class="section-title">Documento di identità</h3>
            <p v-if="['19', '20'].includes(formData.guest_type)" class="section-description">
              Il documento va verificato al check-in; i suoi estremi non saranno inclusi nella schedina PS.
            </p>
            <div class="form-grid">
              <div class="form-group">
                <label class="input-label">Tipo documento</label>
                <input v-model="formData.document.desc" type="text" class="input-field" placeholder="Carta d’identità" />
              </div>
              <div class="form-group">
                <label class="input-label">Numero documento</label>
                <input v-model="formData.document.id" type="text" class="input-field" />
              </div>
              <div class="form-group form-group-full">
                <label class="input-label">Luogo di rilascio</label>
                <input v-model="formData.document.issued_by" type="text" class="input-field" placeholder="Comune italiano o Stato estero" />
              </div>
              <div class="form-group">
                <label class="input-label">Data di rilascio</label>
                <input v-model="formData.document.released" type="date" class="input-field" />
              </div>
              <div class="form-group">
                <label class="input-label">Data di scadenza</label>
                <input v-model="formData.document.expiry" type="date" class="input-field" />
              </div>
            </div>
          </section>
        </div>

        <div v-if="showDelete" class="customer-delete-action">
          <button type="button" class="text-action text-action-danger" @click="$emit('delete')">Elimina</button>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="closeDialog">Annulla</button>
          <button type="submit" class="btn btn-primary">{{ submitLabel }}</button>
        </div>
      </form>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  open: Boolean,
  customer: { type: Object, default: null },
  title: { type: String, default: 'Nuovo Cliente' },
  submitLabel: { type: String, default: 'Salva' },
  showDelete: Boolean,
  embedded: Boolean,
  requireContacts: { type: Boolean, default: true }
});

const emit = defineEmits(['close', 'save', 'delete']);

const emptyCustomer = () => ({
  firstname: '',
  lastname: '',
  email: '',
  phone: '',
  city: '',
  address: '',
  notes: '',
  bookingsCount: 0,
  sex: '',
  guest_type: '',
  state: '',
  birth_date: '',
  birth_state: '',
  birth_place: '',
  birth_district: '',
  document: {
    type: null,
    desc: '',
    id: '',
    released: '',
    expiry: '',
    issued_by: ''
  }
});
const formData = ref(emptyCustomer());
const activeTab = ref('customer');

watch(
  () => [props.open, props.customer],
  () => {
    if (props.open) {
      const customer = props.customer || {};
      formData.value = {
        ...emptyCustomer(),
        ...customer,
        document: { ...emptyCustomer().document, ...(customer.document || {}) }
      };
      activeTab.value = 'customer';
    }
  },
  { immediate: true }
);

const closeDialog = () => emit('close');

const submitForm = () => {
  if (!formData.value.firstname || !formData.value.lastname || (props.requireContacts && (!formData.value.email || !formData.value.phone))) {
    alert(props.requireContacts
      ? 'Compila tutti i campi obbligatori (Nome, Cognome, Email, Telefono)'
      : 'Compila nome e cognome');
    return;
  }
  emit('save', { ...formData.value });
};
</script>

<style scoped>
* { box-sizing: border-box; }
.modal-overlay { position: fixed; inset: 0; background: rgba(36, 49, 66, 0.24); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
.modal-overlay-embedded { position: static; inset: auto; width: 100%; min-width: 0; height: 100%; padding: 0; background: transparent; align-items: stretch; }
.modal-content { background: rgba(255, 255, 255, 0.9); border-radius: 28px; width: 100%; max-width: 600px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: var(--ds-shadow-soft); border: 1px solid rgba(148, 163, 184, 0.18); backdrop-filter: blur(24px); }
.modal-content-embedded { max-width: none; max-height: none; height: 100%; border: 0; border-radius: 0; box-shadow: none; backdrop-filter: none; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-bottom: 1px solid rgba(148, 163, 184, 0.16); }
.modal-title { font-size: 1.25rem; font-weight: 800; color: var(--ds-text); margin: 0; }
.btn-close { background: rgba(255, 255, 255, 0.86); border: 1px solid rgba(148, 163, 184, 0.18); font-size: 1.8rem; color: var(--ds-text-soft); cursor: pointer; line-height: 1; padding: 0; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; border-radius: 14px; transition: background-color 0.16s ease; }
.btn-close:hover { background: rgba(248, 250, 252, 0.92); }
.dialog-tabs { display: flex; gap: 6px; padding: 1rem 1.5rem 0; border-bottom: 1px solid rgba(148, 163, 184, 0.16); }
.dialog-tab { position: relative; border: 0; background: transparent; color: var(--ds-text-soft); cursor: pointer; font: inherit; font-weight: 700; padding: 0.75rem 1rem; }
.dialog-tab::after { position: absolute; right: 0; bottom: -1px; left: 0; height: 2px; border-radius: 999px 999px 0 0; background: transparent; content: ''; }
.dialog-tab.active { color: var(--ds-primary-strong); }
.dialog-tab.active::after { background: var(--ds-primary); }
.modal-body { padding: 1.5rem; overflow-y: auto; flex: 1; }
.form-group { margin-bottom: 1.25rem; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 1rem; }
.form-group-full { grid-column: 1 / -1; }
.form-section + .form-section { margin-top: 0.5rem; padding-top: 1.25rem; border-top: 1px solid rgba(148, 163, 184, 0.16); }
.section-title { margin: 0 0 1rem; color: var(--ds-text); font-size: 0.95rem; font-weight: 800; }
.section-description { margin: -0.5rem 0 1rem; color: var(--ds-text-soft); font-size: 0.82rem; line-height: 1.5; }
.tab-description { margin: 0 0 1.25rem; color: var(--ds-text-soft); font-size: 0.875rem; line-height: 1.5; }
.input-label { display: block; font-size: 0.74rem; font-weight: 800; color: var(--ds-text-soft); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 0.5rem; }
.input-field { width: 100%; min-height: 48px; padding: 0 14px; border: 1px solid rgba(148, 163, 184, 0.22); border-radius: 16px; font-size: 1rem; background: rgba(255, 255, 255, 0.92); color: var(--ds-text); }
.input-field:focus, .textarea-field:focus { outline: none; border-color: rgba(29, 140, 242, 0.45); box-shadow: 0 0 0 4px rgba(29, 140, 242, 0.12); }
.textarea-field { width: 100%; padding: 0.75rem 0.9rem; border: 1px solid rgba(148, 163, 184, 0.22); border-radius: 16px; font-size: 1rem; font-family: inherit; resize: vertical; background: rgba(255, 255, 255, 0.92); color: var(--ds-text); }
.customer-delete-action { display: flex; justify-content: flex-start; padding: 0 1.5rem 1.5rem; }
.text-action { border: 0; background: transparent; cursor: pointer; font: inherit; font-weight: 700; padding: 0; }
.text-action:hover { text-decoration: underline; }
.text-action-danger { color: var(--ds-danger); }
.modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 1.5rem; border-top: 1px solid rgba(148, 163, 184, 0.16); }
.btn { padding: 0.8rem 1.15rem; border: 1px solid transparent; border-radius: 16px; font: inherit; font-weight: 700; cursor: pointer; transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease; font-size: 0.875rem; }
.btn:hover { transform: translateY(-1px); }
.btn-primary { background: linear-gradient(180deg, var(--ds-primary), var(--ds-primary-strong)); color: white; box-shadow: 0 18px 28px rgba(29, 140, 242, 0.18); }
.btn-secondary { background: rgba(255, 255, 255, 0.9); color: var(--ds-text); border-color: rgba(148, 163, 184, 0.18); }
@media (max-width: 768px) { .form-grid { grid-template-columns: 1fr; } .form-group-full { grid-column: auto; } .modal-footer { flex-direction: column; align-items: stretch; } .btn { width: 100%; } }
</style>
