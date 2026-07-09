// Configurazione Supabase
const SUPABASE_URL = 'https://vnpzggqebxcqbtwwwefv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZucHpnZ3FlYnhjcWJ0d3d3ZWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzkyNzYsImV4cCI6MjA4NDQxNTI3Nn0.tYYlfFfvLgF7vMxjMKTF-3Gt1F_XEkB_2A4tL_OeM5Y';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Stato dell'applicazione
let prenotazione = { 
    agente_id: null, 
    servizio_id: null, 
    data: null, 
    ora: null 
};

// Variabili globali
let tuttiGliAgenti = [];
let tuttiIServizi = [];
let tutteLeCompetenze = [];

// Festività in cui il CAF è chiuso
const festivitaItaliane = ['01-01', '01-06', '04-25', '05-01', '06-02', '08-15', '11-01', '12-08', '12-25', '12-26'];

document.addEventListener('DOMContentLoaded', () => {
    inizializzaApp();
});

async function inizializzaApp() {
    await caricaDatiBase();

    // Inizializzazione Calendario con ALT_INPUT Nativo
    flatpickr("#booking-date", {
        locale: "it", 
        dateFormat: "Y-m-d",
        altInput: true, // Attiva la modalità nativa sdoppiata per evitare bug di posizionamento
        altFormat: "j F Y", // Mostra a schermo una data elegante, es: "9 Luglio 2026"
        altInputClass: "w-full bg-zinc-50 border border-zinc-200 hover:border-primary text-primary tracking-wide transition-colors rounded-2xl py-4 px-4 text-center font-bold cursor-pointer outline-none focus:ring-2 focus:ring-primary",
        minDate: "today", 
        disableMobile: true,
        disable: [
            function(date) {
                if (date.getDay() === 0 || date.getDay() === 6) return true;
                const m = (date.getMonth() + 1).toString().padStart(2, '0');
                const d = date.getDate().toString().padStart(2, '0');
                return festivitaItaliane.includes(`${m}-${d}`);
            }
        ],
        onChange: function(selectedDates, dateStr) {
            prenotazione.data = dateStr;
            document.getElementById('summary-date').innerText = dateStr;
            caricaSlotDisponibili(); // Aggiorna e mostra gli orari
        }
    });
}

// Scarica tutti i dati dal database
async function caricaDatiBase() {
    const [resAgenti, resServizi, resCompetenze] = await Promise.all([
        _supabase.from('agenti').select('*').order('nome'),
        _supabase.from('servizi').select('*').order('nome'),
        _supabase.from('competenze').select('*')
    ]);
    
    if (!resAgenti.error) tuttiGliAgenti = resAgenti.data;
    if (!resServizi.error) tuttiIServizi = resServizi.data;
    if (!resCompetenze.error) tutteLeCompetenze = resCompetenze.data;

    renderizzaAgenti();
}

// 1. Mostra i riquadri dei consulenti
function renderizzaAgenti() {
    const container = document.getElementById('agents-grid');
    container.innerHTML = tuttiGliAgenti.map(agente => `
        <div onclick="selezionaAgente('${agente.id}', '${agente.nome}')" id="agent-card-${agente.id}" class="bg-white p-4 rounded-3xl shadow-sm border border-zinc-100 cursor-pointer hover:border-primary hover:shadow-md transition-all flex items-center gap-4">
            <div class="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center text-primary font-bold text-xl uppercase">
                ${agente.nome.charAt(0)}
            </div>
            <div>
                <h3 class="font-bold text-zinc-800 text-lg">${agente.nome}</h3>
                <p class="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Consulente CAF</p>
            </div>
        </div>
    `).join('');
}

// 2. Click sul consulente
function selezionaAgente(id, nome) {
    prenotazione.agente_id = id;
    document.getElementById('summary-agent').innerText = nome;

    document.querySelectorAll('[id^="agent-card-"]').forEach(c => c.classList.remove('ring-2', 'ring-primary', 'bg-primary/5'));
    document.getElementById(`agent-card-${id}`).classList.add('ring-2', 'ring-primary', 'bg-primary/5');

    // Reset rigoroso dei servizi e orari per evitare disallineamenti di stato
    prenotazione.servizio_id = null;
    document.getElementById('summary-service').innerText = '-';
    caricaSlotDisponibili(); // Questo resetterà e nasconderà gli orari
    
    // Filtro competenze
    const serviziAbilitatiId = tutteLeCompetenze
        .filter(c => String(c.agente_id) === String(id))
        .map(c => String(c.servizio_id));
        
    const serviziDisponibili = tuttiIServizi.filter(s => serviziAbilitatiId.includes(String(s.id)));

    renderizzaServizi(serviziDisponibili);
}

// 3. Mostra i riquadri dei servizi
function renderizzaServizi(listaServizi) {
    const section = document.getElementById('services-section');
    const container = document.getElementById('services-grid');

    if (listaServizi.length === 0) {
        container.innerHTML = `<div class="col-span-full p-4 bg-amber-50 text-amber-700 rounded-xl text-sm font-bold">Nessun servizio assegnato a questo consulente.</div>`;
    } else {
        container.innerHTML = listaServizi.map(servizio => {
            const durataMinuti = servizio.durata_minuti || servizio.durata || 30;
            return `
                <div onclick="selezionaServizio('${servizio.id}', '${servizio.nome}')" id="service-card-${servizio.id}" class="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100 cursor-pointer hover:border-primary hover:shadow-md transition-all">
                    <span class="material-symbols-outlined text-primary mb-4 text-3xl">description</span>
                    <h3 class="font-bold text-zinc-800 text-lg leading-tight mb-2">${servizio.nome}</h3>
                    <p class="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">${durataMinuti} MIN</p>
                </div>
            `;
        }).join('');
    }

    section.classList.remove('hidden');
    setTimeout(() => section.classList.remove('opacity-0'), 50);
}

// 4. Click sul servizio
function selezionaServizio(id, nome) {
    prenotazione.servizio_id = id;
    document.getElementById('summary-service').innerText = nome;
    
    document.querySelectorAll('[id^="service-card-"]').forEach(c => c.classList.remove('ring-2', 'ring-primary', 'bg-primary/5'));
    document.getElementById(`service-card-${id}`).classList.add('ring-2', 'ring-primary', 'bg-primary/5');

    caricaSlotDisponibili();
}

// 5. Gestione e Generazione degli Orari (Con controllo disponibilità in tempo reale)
async function caricaSlotDisponibili() {
    const container = document.getElementById('slots-container');
    
    // Se manca anche solo uno dei dati fondamentali, pulisci e nascondi tutto
    if (!prenotazione.servizio_id || !prenotazione.agente_id || !prenotazione.data) {
        container.innerHTML = '';
        container.classList.add('hidden');
        prenotazione.ora = null;
        document.getElementById('summary-time').innerText = '-';
        return;
    }
    
    // Mostra il contenitore con un piccolo messaggio di caricamento per l'utente
    container.classList.remove('hidden');
    container.innerHTML = '<p class="col-span-2 text-center text-sm text-zinc-500 py-4">Verifica disponibilità in corso...</p>';
    
    // --- CONNESSIONE AL DB: Recupero gli appuntamenti già fissati per questo agente in questa data ---
    const { data: appuntamentiOccupati, error } = await _supabase
        .from('appuntamenti')
        .select('ora')
        .eq('agente_id', prenotazione.agente_id)
        .eq('data', prenotazione.data);
        
    // Estraiamo solo gli orari occupati in un array facile da leggere (es. ['10:30', '15:30'])
    // Nota: Supabase salva l'ora come "10:30:00", quindi usiamo substring(0,5) per tagliare i secondi
    let orariGiaPrenotati = [];
    if (!error && appuntamentiOccupati) {
        orariGiaPrenotati = appuntamentiOccupati.map(app => app.ora.substring(0, 5));
    }

    // ORARI UFFICIALI (Mattina 10-12, Pomeriggio 15:30-18:30 ogni 30 min)
    const orariDisponibili = [
        '10:00', '10:30', '11:00', '11:30', '12:00', 
        '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30'
    ];
    
    // Generiamo i bottoni. Se l'orario è nell'array 'orariGiaPrenotati', lo disegniamo spento!
    container.innerHTML = orariDisponibili.map(ora => {
        const isOccupato = orariGiaPrenotati.includes(ora);
        
        if (isOccupato) {
            // BOTTONE SPENTO (Occupato)
            return `
                <button type="button" disabled title="Orario non disponibile" class="py-2 px-4 rounded-xl border border-zinc-100 bg-zinc-50 text-sm font-bold text-zinc-300 cursor-not-allowed line-through">
                    ${ora}
                </button>
            `;
        } else {
            // BOTTONE ACCESO (Libero)
            return `
                <button type="button" onclick="selezionaOra('${ora}')" id="slot-${ora.replace(':','')}" class="py-2 px-4 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-600 hover:border-primary hover:text-primary transition-colors">
                    ${ora}
                </button>
            `;
        }
    }).join('');
    
    // Reset preventivo dell'orario prescelto
    prenotazione.ora = null;
    document.getElementById('summary-time').innerText = '-';
}

function selezionaOra(ora) {
    prenotazione.ora = ora;
    document.getElementById('summary-time').innerText = ora;
    document.querySelectorAll('[id^="slot-"]').forEach(btn => btn.classList.remove('bg-primary', 'text-white', 'border-primary'));
    document.getElementById(`slot-${ora.replace(':','')}`).classList.add('bg-primary', 'text-white', 'border-primary');
}

// Salvataggio sul Database Supabase
async function confermaPrenotazione() {
    const nome = document.getElementById('user-name').value;
    const telefono = document.getElementById('user-phone').value;
    const email = document.getElementById('user-email').value;

    if (!prenotazione.servizio_id || !prenotazione.agente_id || !prenotazione.data || !prenotazione.ora || !nome || !telefono) {
        return Swal.fire({ icon: 'warning', title: 'Dati incompleti', text: 'Assicurati di aver scelto il consulente, il servizio, la data, l\'orario e inserito i tuoi dati.', confirmButtonColor: '#416900' });
    }

    const btn = document.getElementById('btn-conferma');
    btn.disabled = true; 
    btn.innerText = "Salvataggio...";

    const { error } = await _supabase.from('appuntamenti').insert({
        nome_cliente: nome, 
        telefono: telefono, 
        email_cliente: email,
        servizio_id: prenotazione.servizio_id, 
        agente_id: prenotazione.agente_id,
        data: prenotazione.data, 
        ora: prenotazione.ora, 
        stato: 'in attesa'
    });

    btn.disabled = false; 
    btn.innerText = "Conferma Prenotazione";

    if (error) {
        Swal.fire({ icon: 'error', title: 'Errore', text: error.message, confirmButtonColor: '#416900' });
    } else {
        Swal.fire({ icon: 'success', title: 'Prenotazione Confermata!', text: 'I tuoi dati sono stati salvati correttamente.', confirmButtonColor: '#416900' }).then(() => window.location.reload());
    }
}
// REGISTRAZIONE DEL SERVICE WORKER PER ABILITARE L'INSTALLAZIONE PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrato con successo!', reg))
            .catch(err => console.error('Errore nella registrazione del Service Worker:', err));
    });
}