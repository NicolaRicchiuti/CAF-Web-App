const SUPABASE_URL = 'https://vnpzggqebxcqbtwwwefv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZucHpnZ3FlYnhjcWJ0d3d3ZWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzkyNzYsImV4cCI6MjA4NDQxNTI3Nn0.tYYlfFfvLgF7vMxjMKTF-3Gt1F_XEkB_2A4tL_OeM5Y';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// VARIABILI GLOBALI PER RICERCA E PAGINAZIONE
let tuttiGliAppuntamenti = [];
let appuntamentiFiltrati = [];
let tuttiIBlocchi = []; // Contiene la lista dei blocchi attivi
let idBloccoInModifica = null; // Specifica se stiamo creando (null) o modificando un blocco
let paginaCorrente = 1;
const elementsPerPagina = 10; 

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    inizializzaDashboard();
});

async function inizializzaDashboard() {
    await caricaDashboard();
    await caricaBlocchi(); // Carica i blocchi all'avvio
    
    // Ascolta i cambiamenti live degli appuntamenti
    _supabase.channel('admin-live-appuntamenti')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'appuntamenti' }, () => {
        caricaDashboard();
    }).subscribe();

    // Ascolta i cambiamenti live dei blocchi
    _supabase.channel('admin-live-blocchi')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'blocchi' }, () => {
        caricaBlocchi();
    }).subscribe();
}

// =========================================================================
// GESTIONE APPUNTAMENTI CITTADINI
// =========================================================================

async function caricaDashboard() {
    const { data, error } = await _supabase
        .from('appuntamenti').select('*, agenti(nome), servizi(nome)')
        .order('data', { ascending: true }).order('ora', { ascending: true });

    if (error) return;
    
    tuttiGliAppuntamenti = data;
    document.getElementById('count-pending').innerText = data.filter(a => a.stato === 'in attesa').length;
    document.getElementById('count-confirmed').innerText = data.filter(a => a.stato === 'confermato').length;
    
    applicaFiltri(); 
}

function applicaFiltri() {
    const termineRicerca = document.getElementById('search-input').value.toLowerCase();
    
    appuntamentiFiltrati = tuttiGliAppuntamenti.filter(app => {
        const nome = (app.nome_cliente || '').toLowerCase();
        const tel = (app.telefono || '').toLowerCase();
        return nome.includes(termineRicerca) || tel.includes(termineRicerca);
    });

    paginaCorrente = 1; 
    gestisciPaginazione();
}

function gestisciPaginazione() {
    const totalePagine = Math.ceil(appuntamentiFiltrati.length / elementsPerPagina) || 1;
    
    if (paginaCorrente < 1) paginaCorrente = 1;
    if (paginaCorrente > totalePagine) paginaCorrente = totalePagine;

    document.getElementById('page-info').innerText = `Pag ${paginaCorrente} / ${totalePagine}`;
    document.getElementById('btn-prev').disabled = paginaCorrente === 1;
    document.getElementById('btn-next').disabled = paginaCorrente === totalePagine;

    const indiceInizio = (paginaCorrente - 1) * elementsPerPagina;
    const indiceFine = indiceInizio + elementsPerPagina;
    const datiPagina = appuntamentiFiltrati.slice(indiceInizio, indiceFine);

    renderizzaTabella(datiPagina);
}

function cambiaPagina(direzione) {
    paginaCorrente += direzione;
    gestisciPaginazione();
}

function renderizzaTabella(lista) {
    const tbody = document.getElementById('admin-table-body');
    
    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-10 text-zinc-400 font-medium">Nessun appuntamento trovato.</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(app => {
        let telPulito = (app.telefono || '').replace(/\D/g, '');
        if (telPulito && !telPulito.startsWith('39')) {
            telPulito = '39' + telPulito;
        }
        const dataIT = new Date(app.data).toLocaleDateString('it-IT');
        const oraIT = app.ora.substring(0, 5);
        const messaggio = `Gentile ${app.nome_cliente}, ti confermiamo l'appuntamento al CAF UCI per il giorno ${dataIT} alle ore ${oraIT}. A presto!`;
        const linkFallback = telPulito ? `https://wa.me/${telPulito}?text=${encodeURIComponent(messaggio)}` : '#';
        
        const linkFinale = app.link_whatsapp || linkFallback;

        return `
            <tr class="hover:bg-zinc-50 transition-colors animate-fade-in">
                <td class="px-8 py-5">
                    <div class="font-bold text-zinc-800">${app.nome_cliente}</div>
                    <div class="text-[10px] text-zinc-400 font-medium">${app.telefono}</div>
                </td>
                <td class="px-8 py-5">
                    <div class="text-xs font-bold text-zinc-600 uppercase">${app.servizi?.nome}</div>
                    <div class="text-[10px] text-primary italic font-bold">${app.agenti?.nome}</div>
                </td>
                <td class="px-8 py-5 font-bold text-zinc-600">
                    ${dataIT} <span class="text-zinc-300 mx-1">|</span> ${oraIT}
                </td>
                <td class="px-8 py-5">
                    <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${app.stato === 'confermato' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}">${app.stato}</span>
                </td>
                <td class="px-8 py-5 text-right">
                    <div class="flex justify-end items-center gap-1">
                        <button onclick="apriModaleModifica('${app.id}', '${app.agente_id}', '${app.data}', '${app.ora}')" class="p-2 text-zinc-400 hover:text-blue-500 transition-colors" title="Modifica"><span class="material-symbols-outlined">edit</span></button>
                        
                        ${app.stato === 'in attesa' ? `<button onclick="cambiaStato('${app.id}', 'confermato')" class="p-2 text-primary hover:bg-primary/10 rounded-xl transition-all" title="Conferma"><span class="material-symbols-outlined">check_circle</span></button>` : ''}
                        
                        ${telPulito ? `
                            <a href="${linkFinale}" target="_blank" rel="noopener noreferrer" class="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all inline-flex items-center justify-center" title="Invia promemoria WhatsApp">
                                <span class="material-symbols-outlined text-xl">chat</span>
                            </a>
                        ` : ''}

                        <button onclick="elimina('${app.id}')" class="p-2 text-red-300 hover:text-red-500 transition-colors" title="Elimina"><span class="material-symbols-outlined">delete</span></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function cambiaStato(id, nuovo) { 
    await _supabase.from('appuntamenti').update({ stato: nuovo }).eq('id', id); 
}

async function elimina(id) {
    const result = await Swal.fire({ 
        title: 'Sei sicuro?', 
        text: "L'appuntamento verrà eliminato in modo definitivo!", 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#d33', 
        cancelButtonColor: '#a1a1aa', 
        confirmButtonText: 'Sì, elimina', 
        cancelButtonText: 'Annulla' 
    });
    if (result.isConfirmed) { 
        await _supabase.from('appuntamenti').delete().eq('id', id); 
    }
}

async function apriModaleModifica(id, agenteId, data, ora) {
    const { data: agenti } = await _supabase.from('agenti').select('*');
    document.getElementById('edit-agent').innerHTML = agenti.map(a => `<option value="${a.id}" ${a.id == agenteId ? 'selected' : ''}>${a.nome}</option>`).join('');
    document.getElementById('edit-app-id').value = id; 
    document.getElementById('edit-date').value = data; 
    document.getElementById('edit-time').value = ora.substring(0,5);
    document.getElementById('modal-modifica').classList.remove('hidden');
}

function chiudiModaleModifica() { 
    document.getElementById('modal-modifica').classList.add('hidden'); 
}

async function salvaModifiche(btn) {
    btn.disabled = true;
    await _supabase.from('appuntamenti').update({ 
        agente_id: document.getElementById('edit-agent').value, 
        data: document.getElementById('edit-date').value, 
        ora: document.getElementById('edit-time').value 
    }).eq('id', document.getElementById('edit-app-id').value);
    
    chiudiModaleModifica(); 
    caricaDashboard(); 
    Swal.fire({ icon: 'success', title: 'Aggiornato', showConfirmButton: false, timer: 1500 });
    btn.disabled = false;
}

// =========================================================================
// NUOVO: GESTIONE COMPLETA BLOCCHI ORARI E FERIE (CRUD)
// =========================================================================

async function caricaBlocchi() {async function caricaBlocchi() {
    const { data, error } = await _supabase
        .from('blocchi')
        .select('*, agenti(nome)')
        .order('data', { ascending: true });

    // Modifichiamo questo blocco per stampare l'errore reale in console
    if (error) {
        console.error("❌ ERRORE RICEVUTO DA SUPABASE PER I BLOCCHI:", error);
        return;
    }
    
    tuttiIBlocchi = data;
    renderizzaTabellaBlocchi(data);
}

function renderizzaTabellaBlocchi(lista) {
    const tbody = document.getElementById('admin-blocks-table-body');
    if (!tbody) return; // Paracadute se l'HTML non è ancora pronto
    
    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-zinc-400 text-sm font-medium">Nessun blocco orario o ferie attivo.</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(blocco => {
        const dataIT = new Date(blocco.data).toLocaleDateString('it-IT');
        
        // Determina se il blocco copre l'intera giornata o solo una fascia oraria
        const isFerie = (blocco.ora_inizio === "00:00:00" && blocco.ora_fine === "23:59:00");
        const visualizzazioneOrario = isFerie 
            ? `<span class="px-2 py-1 rounded bg-red-50 text-red-600 font-bold text-[10px]">🌴 INTERA GIORNATA (FERIE)</span>` 
            : `${blocco.ora_inizio.substring(0,5)} - ${blocco.ora_fine.substring(0,5)}`;
            
        // Identifica a quale operatore si riferisce il blocco
        const nomeConsulente = blocco.agenti ? blocco.agenti.nome : '<span class="text-amber-600 font-bold">TUTTI (Chiusura Sede)</span>';

        return `
            <tr class="hover:bg-zinc-50 transition-colors">
                <td class="px-8 py-4 font-bold text-zinc-800">${nomeConsulente}</td>
                <td class="px-8 py-4 text-zinc-600 font-medium">${dataIT}</td>
                <td class="px-8 py-4 text-zinc-600 font-bold">${visualizzazioneOrario}</td>
                <td class="px-8 py-4 text-right">
                    <div class="flex justify-end items-center gap-2">
                        <button onclick="apriModificaBlocco('${blocco.id}', '${blocco.agente_id}', '${blocco.data}', '${blocco.ora_inizio}', '${blocco.ora_fine}')" class="p-2 text-zinc-400 hover:text-blue-500 transition-colors" title="Sposta / Modifica">
                            <span class="material-symbols-outlined text-xl">edit</span>
                        </button>
                        <button onclick="eliminaBlocco('${blocco.id}')" class="p-2 text-red-300 hover:text-red-500 transition-colors" title="Rimuovi Blocco">
                            <span class="material-symbols-outlined text-xl">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function apriModaleBlocco() {
    idBloccoInModifica = null; // Specifichiamo che stiamo creando un NUOVO blocco
    
    const { data: agenti } = await _supabase.from('agenti').select('*').order('nome');
    document.getElementById('block-agent').innerHTML = `<option value="all">Tutti (Chiusura Ufficio)</option>` + agenti.map(a => `<option value="${a.id}">${a.nome}</option>`).join('');
    
    // Reset dei campi del modulo
    document.getElementById('block-date').value = "";
    document.getElementById('block-fullday').checked = false;
    document.getElementById('block-start').value = "09:00";
    document.getElementById('block-end').value = "18:00";
    
    toggleOrariBlocco();
    
    // Modifichiamo il testo del bottone per chiarezza grafica
    const btnConferma = document.querySelector('#modal-blocco button[onclick^="salvaBlocco"]');
    if(btnConferma) btnConferma.innerText = "Conferma Blocco";
    
    document.getElementById('modal-blocco').classList.remove('hidden');
}

// Funzione attivata quando si preme il tasto Modifica (Matita) sulla tabella dei blocchi
function apriModificaBlocco(id, agenteId, data, oraInizio, oraFine) {
    idBloccoInModifica = id; // Memorizziamo l'id del record da aggiornare
    
    apriModaleBlocco().then(() => {
        // Selezioniamo i valori vecchi all'interno degli input della modale
        document.getElementById('block-agent').value = (agenteId === "null" || !agenteId) ? "all" : agenteId;
        document.getElementById('block-date').value = data;
        
        const isFull = (oraInizio === "00:00:00" && oraFine === "23:59:00");
        document.getElementById('block-fullday').checked = isFull;
        
        if(!isFull) {
            document.getElementById('block-start').value = oraInizio.substring(0,5);
            document.getElementById('block-end').value = oraFine.substring(0,5);
        }
        
        toggleOrariBlocco();
        
        // Modifichiamo il testo del bottone per segnalare la modifica in corso
        const btnConferma = document.querySelector('#modal-blocco button[onclick^="salvaBlocco"]');
        if(btnConferma) btnConferma.innerText = "Salva Modifiche Blocco";
    });
}

function chiudiModaleBlocco() { 
    document.getElementById('modal-blocco').classList.add('hidden'); 
    idBloccoInModifica = null;
}

function toggleOrariBlocco() { 
    document.getElementById('block-times-container').style.display = document.getElementById('block-fullday').checked ? 'none' : 'grid'; 
}

async function salvaBlocco(btn) {
    const data = document.getElementById('block-date').value; 
    const isFull = document.getElementById('block-fullday').checked;
    
    if(!data) return Swal.fire({ icon: 'warning', title: 'Attenzione', text: 'Scegli una data.' });
    
    btn.disabled = true;
    
    const agenteValore = document.getElementById('block-agent').value;
    const datiBlocco = {
        agente_id: agenteValore === 'all' ? null : agenteValore, 
        data: data, 
        ora_inizio: isFull ? "00:00:00" : document.getElementById('block-start').value + ":00", 
        ora_fine: isFull ? "23:59:00" : document.getElementById('block-end').value + ":00"
    };

    let risposta;
    
    if (idBloccoInModifica) {
        // MODALITÀ UPDATE: Aggiorna il blocco esistente
        risposta = await _supabase.from('blocchi').update(datiBlocco).eq('id', idBloccoInModifica);
    } else {
        // MODALITÀ INSERT: Crea un nuovo blocco
        risposta = await _supabase.from('blocchi').insert(datiBlocco);
    }
    
    if (risposta.error) {
        Swal.fire({ icon: 'error', text: risposta.error.message }); 
    } else { 
        Swal.fire({ icon: 'success', title: idBloccoInModifica ? 'Blocco Spostato!' : 'Blocco Creato!' }); 
        chiudiModaleBlocco(); 
        caricaBlocchi(); // Ricarica la tabella dei blocchi
    }
    
    btn.disabled = false;
}

async function eliminaBlocco(id) {
    const result = await Swal.fire({ 
        title: 'Rimuovere il blocco?', 
        text: 'Gli orari selezionati torneranno immediatamente disponibili per le prenotazioni dei cittadini!', 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#d33', 
        cancelButtonColor: '#a1a1aa', 
        confirmButtonText: 'Sì, rimuovi', 
        cancelButtonText: 'Annulla' 
    });
    
    if (result.isConfirmed) { 
        await _supabase.from('blocchi').delete().eq('id', id); 
        caricaBlocchi();
    }
}

// =========================================================================
// ACCOUNT / LOGOUT
// =========================================================================

async function eseguiLogout() {
    if ((await Swal.fire({ title: 'Vuoi uscire?', icon: 'question', showCancelButton: true, confirmButtonText: 'Sì, esci', cancelButtonText: 'Rimani' })).isConfirmed) {
        await _supabase.auth.signOut(); 
        window.location.href = 'login.html';
    }
}