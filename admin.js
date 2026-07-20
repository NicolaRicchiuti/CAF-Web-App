const SUPABASE_URL = 'https://vnpzggqebxcqbtwwwefv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZucHpnZ3FlYnhjcWJ0d3d3ZWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzkyNzYsImV4cCI6MjA4NDQxNTI3Nn0.tYYlfFfvLgF7vMxjMKTF-3Gt1F_XEkB_2A4tL_OeM5Y';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// VARIABILI GLOBALI PER RICERCA E PAGINAZIONE
let tuttiGliAppuntamenti = [];
let appuntamentiFiltrati = [];
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
    
    _supabase.channel('admin-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'appuntamenti' }, () => {
        caricaDashboard();
    }).subscribe();
}

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

// RENDER TABELLA (Calcola il link WhatsApp al volo per TUTTI i record)
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

async function apriModaleBlocco() {
    const { data: agenti } = await _supabase.from('agenti').select('*').order('nome');
    document.getElementById('block-agent').innerHTML = `<option value="all">Tutti (Chiusura Ufficio)</option>` + agenti.map(a => `<option value="${a.id}">${a.nome}</option>`).join('');
    document.getElementById('modal-blocco').classList.remove('hidden');
}

function chiudiModaleBlocco() { 
    document.getElementById('modal-blocco').classList.add('hidden'); 
}

function toggleOrariBlocco() { 
    document.getElementById('block-times-container').style.display = document.getElementById('block-fullday').checked ? 'none' : 'grid'; 
}

async function salvaBlocco(btn) {
    const data = document.getElementById('block-date').value; 
    const isFull = document.getElementById('block-fullday').checked;
    
    if(!data) return Swal.fire({ icon: 'warning', title: 'Attenzione', text: 'Scegli una data.' });
    
    btn.disabled = true;
    
    // Configurazione dell'oggetto da inserire, allineato alle colonne reali del database
    const { error } = await _supabase.from('blocchi').insert({ 
        agente_id: document.getElementById('block-agent').value === 'all' ? null : document.getElementById('block-agent').value, 
        data: data, 
        ora_inizio: isFull ? "00:00:00" : document.getElementById('block-start').value, 
        ora_fine: isFull ? "23:59:00" : document.getElementById('block-end').value
    });
    
    if (error) {
        Swal.fire({ icon: 'error', text: error.message }); 
    } else { 
        Swal.fire({ icon: 'success', title: 'Salvato' }); 
        chiudiModaleBlocco(); 
    }
    
    btn.disabled = false;
}

async function eseguiLogout() {
    if ((await Swal.fire({ title: 'Vuoi uscire?', icon: 'question', showCancelButton: true, confirmButtonText: 'Sì, esci', cancelButtonText: 'Rimani' })).isConfirmed) {
        await _supabase.auth.signOut(); 
        window.location.href = 'login.html';
    }
}