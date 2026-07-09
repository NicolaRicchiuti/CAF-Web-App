const SUPABASE_URL = 'https://vnpzggqebxcqbtwwwefv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZucHpnZ3FlYnhjcWJ0d3d3ZWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzkyNzYsImV4cCI6MjA4NDQxNTI3Nn0.tYYlfFfvLgF7vMxjMKTF-3Gt1F_XEkB_2A4tL_OeM5Y';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let prenotazione = { agenteId: null, agenteNome: null, servizioId: null, servizioNome: null, data: null, ora: null };
const festivitaItaliane = ["01-01", "01-06", "04-25", "05-01", "06-02", "08-15", "11-01", "12-08", "12-25", "12-26"];

document.addEventListener('DOMContentLoaded', inizializzaApp);

async function inizializzaApp() {
    caricaAgenti();

    // Inizializzazione Calendario
    const fp = flatpickr("#booking-date", {
        locale: "it",
        dateFormat: "Y-m-d",
        minDate: "today",
        static: true,
        appendTo: document.getElementById('calendar-anchor'),
        disable: [
            date => {
                if (date.getDay() === 0 || date.getDay() === 6) return true;
                const m = (date.getMonth() + 1).toString().padStart(2, '0');
                const d = date.getDate().toString().padStart(2, '0');
                return festivitaItaliane.includes(`${m}-${d}`);
            }
        ],
        onChange: (selectedDates, dateStr) => {
            prenotazione.data = dateStr;
            const dataLeggibile = selectedDates[0].toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
            document.getElementById('date-trigger').innerText = dataLeggibile;
            document.getElementById('summary-date').innerText = dateStr;
            caricaSlotDisponibili();
        }
    });

    document.getElementById('date-trigger').addEventListener('click', () => {
        if (!prenotazione.servizioId) {
            Swal.fire({ icon: 'warning', title: 'Attenzione', text: 'Seleziona prima un consulente e un servizio.', confirmButtonColor: '#416900' });
            return;
        }
        fp.toggle();
    });
}

// 1. CARICA AGENTI
async function caricaAgenti() {
    const { data, error } = await _supabase.from('agenti').select('*').order('nome');
    if (error) return console.error(error);
    
    document.getElementById('agent-grid').innerHTML = data.map(a => `
        <div onclick="selezionaAgente('${a.id}', '${a.nome}')" id="ag-${a.id}" class="agent-card-mobile min-w-[200px] cursor-pointer snap-start border-2 border-transparent transition-all">
            <img src="https://ui-avatars.com/api/?name=${a.nome}&background=random" class="w-16 h-16 rounded-full mx-auto mb-4 shadow-sm">
            <h3 class="font-bold text-zinc-800 text-center text-sm">${a.nome}</h3>
            <p class="text-[10px] text-zinc-400 font-bold uppercase tracking-widest text-center">Consulente UCI</p>
        </div>`).join('');
}

function selezionaAgente(id, nome) {
    prenotazione.agenteId = parseInt(id);
    prenotazione.agenteNome = nome;
    document.getElementById('summary-agent').innerText = nome;
    
    document.querySelectorAll('.agent-card-mobile').forEach(c => c.classList.remove('border-primary-container', 'bg-primary/5'));
    const card = document.getElementById(`ag-${id}`);
    if (card) card.classList.add('border-primary-container', 'bg-primary/5');

    // Reset selezioni successive
    prenotazione.servizioId = null;
    prenotazione.data = null;
    prenotazione.ora = null;
    document.getElementById('summary-date').innerText = "-";
    document.getElementById('date-trigger').innerText = "Seleziona una data";
    document.getElementById('time-slots').innerHTML = "";
    
    caricaServizi(prenotazione.agenteId);
}

// 2. CARICA SERVIZI
async function caricaServizi(agenteId) {
    const list = document.getElementById('service-list');
    list.innerHTML = '<p class="col-span-full text-center py-8 text-zinc-400 uppercase text-[10px] font-bold">Caricamento...</p>';

    const { data: competenze } = await _supabase.from('competenze').select('*');
    const { data: servizi } = await _supabase.from('servizi').select('*');

    const idsAbilitati = competenze
        .filter(c => parseInt(c.agente_id) === agenteId)
        .map(c => parseInt(c.servizio_id));

    const finali = servizi.filter(s => idsAbilitati.includes(parseInt(s.id)));

    if (finali.length === 0) {
        list.innerHTML = '<p class="col-span-full text-zinc-400 italic text-center py-12">Nessun servizio disponibile.</p>';
        return;
    }

    list.innerHTML = finali.map(s => `
        <div onclick="selezionaServizio('${s.id}', '${s.nome}')" id="ser-${s.id}" class="service-card group bg-white border border-zinc-100">
            <span class="material-symbols-outlined text-primary mb-4 text-3xl">description</span>
            <span class="font-bold leading-tight text-sm text-zinc-700">${s.nome}</span>
            <span class="text-[10px] text-zinc-400 font-bold mt-2 uppercase">30 min</span>
        </div>`).join('');
}

function selezionaServizio(id, nome) {
    prenotazione.servizioId = id;
    prenotazione.servizioNome = nome;
    document.querySelectorAll('.service-card').forEach(c => c.classList.remove('active'));
    const card = document.getElementById(`ser-${id}`);
    if (card) card.classList.add('active');
}

// 3. CARICA ORARI (DISPONIBILITÀ)
async function caricaSlotDisponibili() {
    const slotContainer = document.getElementById('time-slots');
    slotContainer.innerHTML = '<p class="col-span-3 text-center text-[10px] font-bold text-zinc-400 uppercase">Verifica...</p>';
    
    // Recupera appuntamenti esistenti e blocchi
    const { data: app } = await _supabase.from('appuntamenti').select('ora').eq('data', prenotazione.data).eq('agente_id', prenotazione.agenteId);
    const { data: bl } = await _supabase.from('blocchi').select('*').eq('data', prenotazione.data).eq('agente_id', prenotazione.agenteId);
    
    const occupati = app ? app.map(a => a.ora.substring(0, 5)) : [];
    const slots = [];
    
    // Genera slot 09:00 - 18:00
    for (let h = 9; h < 18; h++) {
        for (let m of ['00', '30']) {
            const ora = `${h.toString().padStart(2,'0')}:${m}`;
            const isBlocked = bl ? bl.some(b => ora >= b.ora_inizio && ora < b.ora_fine) : false;
            if (!isBlocked && !occupati.includes(ora)) slots.push(ora);
        }
    }
    
    if (slots.length === 0) {
        slotContainer.innerHTML = '<p class="col-span-3 text-center text-[10px] text-red-400 font-bold uppercase py-4">Pieno</p>';
        return;
    }

    slotContainer.innerHTML = slots.map(ora => `
        <button onclick="selezionaOra('${ora}', this)" class="slot-pill">${ora}</button>
    `).join('');
}

function selezionaOra(ora, btn) {
    prenotazione.ora = ora;
    document.querySelectorAll('.slot-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

// 4. INVIO PRENOTAZIONE
function confermaPrenotazione() {
    if (!prenotazione.agenteId || !prenotazione.servizioId || !prenotazione.data || !prenotazione.ora) {
        Swal.fire({
            icon: 'warning',
            title: 'Dati incompleti',
            text: 'Assicurati di aver selezionato Consulente, Servizio, Data e Orario.',
            confirmButtonColor: '#416900'
        });
        return;
    }
    document.getElementById('booking-modal').classList.remove('hidden');
}

function chiudiModale() { document.getElementById('booking-modal').classList.add('hidden'); }

async function inviaPrenotazioneDefinitiva(btn) {
    const nome = document.getElementById('client-name').value.trim();
    const tel = document.getElementById('client-phone').value.trim();
    const email = document.getElementById('client-email').value.trim();
    const privacyAccettata = document.getElementById('privacy-policy').checked;
    
    if (!nome || !tel) {
        Swal.fire({ icon: 'error', title: 'Campi obbligatori', text: 'Nome e Cellulare sono obbligatori.', confirmButtonColor: '#416900' });
        return;
    }

    if (!privacyAccettata) {
        Swal.fire({ icon: 'warning', title: 'Privacy obbligatoria', text: 'Devi accettare il trattamento dei dati per procedere.', confirmButtonColor: '#416900' });
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="animate-pulse">Elaborazione in corso...</span>';

    const { error } = await _supabase.from('appuntamenti').insert({
        agente_id: prenotazione.agenteId,
        servizio_id: prenotazione.servizioId,
        data: prenotazione.data,
        ora: prenotazione.ora,
        nome_cliente: nome,
        email_cliente: email || null,
        telefono: tel,
        stato: 'in attesa'
    });

    if (error) {
        Swal.fire({ icon: 'error', title: 'Errore di sistema', text: error.message, confirmButtonColor: '#416900' });
        btn.disabled = false;
        btn.innerHTML = 'Completa Prenotazione';
    } else {
        Swal.fire({
            icon: 'success',
            title: 'Prenotazione Confermata!',
            text: 'La tua richiesta è stata inviata al CAF con successo.',
            confirmButtonColor: '#416900',
            allowOutsideClick: false
        }).then((result) => {
            if (result.isConfirmed) {
                location.reload();
            }
        });
    }
}