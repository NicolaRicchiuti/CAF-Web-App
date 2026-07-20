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
let tuttiIBlocchi = []; // NUOVO: Contiene i blocchi inseriti dall'admin

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
        altInput: true, 
        altFormat: "j F Y", 
        altInputClass: "w-full bg-zinc-50 border border-zinc-200 hover:border-primary text-primary tracking-wide transition-colors rounded-2xl py-4 px-4 text-center font-bold cursor-pointer outline-none focus:ring-2 focus:ring-primary",
        minDate: "today", 
        disableMobile: true,
        disable: [
            function(date) {
                // 1. Blocco Sabato (6) e Domenica (0)
                if (date.getDay() === 0 || date.getDay() === 6) return true;
                
                // 2. Blocco Festività Italiane Nazionali
                const m = (date.getMonth() + 1).toString().padStart(2, '0');
                const d = date.getDate().toString().padStart(2, '0');
                if (festivitaItaliane.includes(`${m}-${d}`)) return true;

                // 3. NUOVO: Blocco "Intera Giornata (Ferie / Chiusura Ufficio)" da Admin
                const dataCorrenteStr = `${date.getFullYear()}-${m}-${d}`;
                const isUfficioChiuso = tuttiIBlocchi.some(b => 
                    b.data === dataCorrenteStr && 
                    b.agente_id === null && 
                    b.ora_inizio === "00:00:00" && 
                    b.ora_fine === "23:59:00"
                );
                
                return isUfficioChiuso;
            }
        ],
        onChange: function(selectedDates, dateStr) {
            prenotazione.data = dateStr;
            document.getElementById('summary-date').innerText = dateStr;
            caricaSlotDisponibili(); 
        }
    });
}

// Scarica tutti i dati dal database (Incluso i blocchi orari)
async function caricaDatiBase() {
    const [resAgenti, resServizi, resCompetenze, resBlocchi] = await Promise.all([
        _supabase.from('agenti').select('*').order('nome'),
        _supabase.from('servizi').select('*').order('nome'),
        _supabase.from('competenze').select('*'),
        _supabase.from('blocchi').select('*') // Scarichiamo i blocchi dal database
    ]);
    
    if (!resAgenti.error) tuttiGliAgenti = resAgenti.data;
    if (!resServizi.error) tuttiIServizi = resServizi.data;
    if (!resCompetenze.error) tutteLeCompetenze = resCompetenze.data;
    if (!resBlocchi.error) tuttiIBlocchi = resBlocchi.data; // Salviamo i blocchi nella variabile globale

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

    prenotazione.servizio_id = null;
    document.getElementById('summary-service').innerText = '-';
    caricaSlotDisponibili(); 
    
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

// 5. Gestione e Generazione degli Orari (Aggiornato con filtro blocchi ferie/orari)
async function caricaSlotDisponibili() {
    const container = document.getElementById('slots-container');
    
    if (!prenotazione.servizio_id || !prenotazione.agente_id || !prenotazione.data) {
        container.innerHTML = '';
        container.classList.add('hidden');
        prenotazione.ora = null;
        document.getElementById('summary-time').innerText = '-';
        return;
    }
    
    container.classList.remove('hidden');
    container.innerHTML = '<p class="col-span-2 text-center text-sm text-zinc-500 py-4">Verifica disponibilità in corso...</p>';
    
    // Connessione per verificare gli appuntamenti già presi dai clienti
    const { data: appuntamentiOccupati, error } = await _supabase
        .from('appuntamenti')
        .select('ora')
        .eq('agente_id', prenotazione.agente_id)
        .eq('data', prenotazione.data);
        
    let orariGiaPrenotati = [];
    if (!error && appuntamentiOccupati) {
        orariGiaPrenotati = appuntamentiOccupati.map(app => app.ora.substring(0, 5));
    }

    // Tabella Orari Ufficiali di base
    const orariStandard = [
        '10:00', '10:30', '11:00', '11:30', '12:00', 
        '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30'
    ];
    
    // NUOVO: Applichiamo il filtro escludendo gli orari che l'admin ha bloccato per questo giorno/agente
    const orariDisponibili = filtraOrariMancanti(orariStandard, prenotazione.data, prenotazione.agente_id, tuttiIBlocchi);
    
    if (orariDisponibili.length === 0) {
        container.innerHTML = '<p class="col-span-full text-center text-sm text-amber-600 bg-amber-50 p-4 rounded-2xl font-bold">Nessun orario disponibile per questo giorno (Blocco Operatore o Ufficio).</p>';
        return;
    }

    container.innerHTML = orariDisponibili.map(ora => {
        const isOccupato = orariGiaPrenotati.includes(ora);
        
        if (isOccupato) {
            return `
                <button type="button" disabled title="Orario non disponibile" class="py-2 px-4 rounded-xl border border-zinc-100 bg-zinc-50 text-sm font-bold text-zinc-300 cursor-not-allowed line-through">
                    ${ora}
                </button>
            `;
        } else {
            return `
                <button type="button" onclick="selezionaOra('${ora}')" id="slot-${ora.replace(':','')}" class="py-2 px-4 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-600 hover:border-primary hover:text-primary transition-colors">
                    ${ora}
                </button>
            `;
        }
    }).join('');
    
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
    const privacyCheck = document.getElementById('accetta-privacy');

    if (!prenotazione.servizio_id || !prenotazione.agente_id || !prenotazione.data || !prenotazione.ora || !nome || !telefono || !privacyCheck.checked) {
        return Swal.fire({ 
            icon: 'warning', 
            title: 'Dati incompleti o Privacy mancante', 
            text: 'Assicurati di aver scelto il consulente, il servizio, la data, l\'orario, inserito i tuoi dati e accettato la Privacy Policy.', 
            confirmButtonColor: '#416900' 
        });
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

    if (error) {
        btn.disabled = false; 
        btn.innerText = "Conferma Prenotazione";
        return Swal.fire({ icon: 'error', title: 'Errore', text: error.message, confirmButtonColor: '#416900' });
    }

    try {
        const nomeServizio = document.getElementById('summary-service').innerText;
        const nomeAgente = document.getElementById('summary-agent').innerText;

        const emailResponse = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nome: nome,
                email: email,
                servizio: nomeServizio,
                telefono: telefono,
                agente: nomeAgente,
                data: prenotazione.data,
                ora: prenotazione.ora
            })
        });

        if (!emailResponse.ok) {
            const erroreDettagli = await emailResponse.json();
            console.error("❌ ERRORE SERVERLESS EMAIL:", erroreDettagli);
        } else {
            console.log("📩 Email inviata con successo tramite Resend!");
        }

    } catch (emailError) {
        console.error("❌ ERRORE DI RETE CON LE EMAIL:", emailError);
    }

    btn.disabled = false; 
    btn.innerText = "Conferma Prenotazione";

    Swal.fire({ 
        icon: 'success', 
        title: 'Prenotazione Confermata!', 
        text: 'I tuoi dati sono stati salvati correttamente. Riceverai un\'email di conferma.', 
        confirmButtonColor: '#416900' 
    }).then(() => window.location.reload());
}

// =========================================================================
// NUOVE FUNZIONI DI UTILITÀ PER IL FILTRO DEI BLOCCHI ORARI
// =========================================================================

// Funzione principale che esclude gli orari coperti da ferie o blocchi specifici
function filtraOrariMancanti(orariStandard, dataSelezionata, agenteSelezionato, listaBlocchi) {
    // Filtriamo i blocchi validi per la data scelta e che interessano o TUTTI (null) o l'agente specifico
    const blocchiDiOggi = listaBlocchi.filter(b => 
        b.data === dataSelezionata && 
        (b.agente_id === null || String(b.agente_id) === String(agenteSelezionato))
    );

    if (blocchiDiOggi.length === 0) return orariStandard;

    return orariStandard.filter(ora => {
        const oraInMinuti = convertiOraInMinuti(ora);

        // Se l'orario del bottone cade dentro la fascia di un blocco, viene scartato
        const copertoDaBlocco = blocchiDiOggi.some(blocco => {
            const inizioMinuti = convertiOraInMinuti(blocco.ora_inizio);
            const fineMinuti = convertiOraInMinuti(blocco.ora_fine);
            return oraInMinuti >= inizioMinuti && oraInMinuti <= fineMinuti;
        });

        return !copertoDaBlocco;
    });
}

// Converte stringhe orario come "10:30" o "15:00:00" in minuti totali dall'inizio del giorno per confronti matematici
function convertiOraInMinuti(stringaOra) {
    const parti = stringaOra.split(':');
    const ore = parseInt(parti[0], 10);
    const minuti = parseInt(parti[1], 10);
    return (ore * 60) + minuti;
}

// REGISTRAZIONE DEL SERVICE WORKER
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrato con successo!', reg))
            .catch(err => console.error('Errore nella registrazione del Service Worker:', err));
    });
}