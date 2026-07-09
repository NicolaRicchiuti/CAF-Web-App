// Configurazione Supabase
const SUPABASE_URL = 'https://vnpzggqebxcqbtwwwefv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZucHpnZ3FlYnhjcWJ0d3d3ZWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzkyNzYsImV4cCI6MjA4NDQxNTI3Nn0.tYYlfFfvLgF7vMxjMKTF-3Gt1F_XEkB_2A4tL_OeM5Y';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Stato dell'applicazione
let prenotazione = {
    servizio_id: null,
    data: null,
    ora: null,
    agente_id: null
};

// Festività standard in cui il CAF è chiuso
const festivitaItaliane = ['01-01', '01-06', '04-25', '05-01', '06-02', '08-15', '11-01', '12-08', '12-25', '12-26'];

// Inizializzazione al caricamento della pagina
document.addEventListener('DOMContentLoaded', () => {
    inizializzaApp();
});

async function inizializzaApp() {
    await caricaServizi();

    // Inizializzazione Calendario - FIX: Rimossi static e appendTo per UI mobile e PWA
    flatpickr("#booking-date", {
        locale: "it",
        dateFormat: "Y-m-d",
        minDate: "today",
        disableMobile: true, // Impedisce ai dispositivi iOS/Android di aprire il loro calendario standard
        disable: [
            function(date) {
                // Disabilita Sabato (6) e Domenica (0)
                if (date.getDay() === 0 || date.getDay() === 6) return true;
                
                // Disabilita festività
                const m = (date.getMonth() + 1).toString().padStart(2, '0');
                const d = date.getDate().toString().padStart(2, '0');
                return festivitaItaliane.includes(`${m}-${d}`);
            }
        ],
        onChange: function(selectedDates, dateStr, instance) {
            prenotazione.data = dateStr;
            const dataLeggibile = selectedDates[0].toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
            
            // Aggiorna l'interfaccia utente
            document.getElementById('date-trigger').innerText = dataLeggibile;
            document.getElementById('summary-date').innerText = dateStr;
            
            caricaSlotDisponibili();
        }
    });
}

// Genera i servizi a schermo
async function caricaServizi() {
    const { data, error } = await _supabase.from('servizi').select('*').order('nome');
    if (error) {
        console.error("Errore caricamento servizi:", error);
        return;
    }

    const container = document.getElementById('services-grid');
    container.innerHTML = data.map(servizio => `
        <div onclick="selezionaServizio('${servizio.id}', '${servizio.nome}')" id="card-${servizio.id}" class="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100 cursor-pointer hover:border-primary hover:shadow-md transition-all">
            <span class="material-symbols-outlined text-primary mb-4 text-3xl">description</span>
            <h3 class="font-bold text-zinc-800 text-lg leading-tight mb-2">${servizio.nome}</h3>
            <p class="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">${servizio.durata_minuti} MIN</p>
        </div>
    `).join('');
}

// Azione al click di un servizio
function selezionaServizio(id, nome) {
    prenotazione.servizio_id = id;
    document.getElementById('summary-service').innerText = nome;
    
    // Reset stile di tutte le card
    document.querySelectorAll('[id^="card-"]').forEach(card => {
        card.classList.remove('ring-2', 'ring-primary', 'bg-primary/5');
    });
    
    // Evidenzia la card scelta
    const selectedCard = document.getElementById(`card-${id}`);
    selectedCard.classList.add('ring-2', 'ring-primary', 'bg-primary/5');

    // Se l'utente aveva già scelto una data, ricarica gli orari
    if (prenotazione.data) caricaSlotDisponibili();
}

// Generazione fittizia degli slot orari
async function caricaSlotDisponibili() {
    if (!prenotazione.servizio_id || !prenotazione.data) return;

    const container = document.getElementById('slots-container');
    container.classList.remove('hidden');
    
    // Array di slot generici di test
    const slotFinti = ['09:00', '09:30', '10:00', '11:00', '11:30', '15:00', '16:00', '16:30'];
    
    container.innerHTML = slotFinti.map(ora => `
        <button onclick="selezionaOra('${ora}')" id="slot-${ora.replace(':','')}" class="py-2 px-4 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-600 hover:border-primary hover:text-primary transition-colors">${ora}</button>
    `).join('');
}

// Azione al click di uno slot orario
function selezionaOra(ora) {
    prenotazione.ora = ora;
    document.getElementById('summary-time').innerText = ora;

    // Reset stile
    document.querySelectorAll('[id^="slot-"]').forEach(btn => {
        btn.classList.remove('bg-primary', 'text-white', 'border-primary');
    });

    // Evidenzia scelta
    const selectedBtn = document.getElementById(`slot-${ora.replace(':','')}`);
    selectedBtn.classList.add('bg-primary', 'text-white', 'border-primary');
}

// Salvataggio sul Database Supabase
async function confermaPrenotazione() {
    const nome = document.getElementById('user-name').value;
    const telefono = document.getElementById('user-phone').value;
    const email = document.getElementById('user-email').value;

    if (!prenotazione.servizio_id || !prenotazione.data || !prenotazione.ora || !nome || !telefono) {
        return Swal.fire({ 
            icon: 'warning', 
            title: 'Dati incompleti', 
            text: 'Compila tutti i campi obbligatori per proseguire.', 
            confirmButtonColor: '#416900' 
        });
    }

    const btn = document.getElementById('btn-conferma');
    btn.disabled = true;
    btn.innerText = "Salvataggio...";

    // Estrae un ID agente casuale a scopo di test
    const { data: agenti } = await _supabase.from('agenti').select('id').limit(1);
    const agenteId = agenti[0]?.id;

    const { error } = await _supabase.from('appuntamenti').insert({
        nome_cliente: nome,
        telefono: telefono,
        email_cliente: email,
        servizio_id: prenotazione.servizio_id,
        agente_id: agenteId,
        data: prenotazione.data,
        ora: prenotazione.ora,
        stato: 'in attesa'
    });

    btn.disabled = false;
    btn.innerText = "Conferma Prenotazione";

    if (error) {
        Swal.fire({ icon: 'error', title: 'Errore', text: error.message, confirmButtonColor: '#416900' });
    } else {
        Swal.fire({ 
            icon: 'success', 
            title: 'Prenotazione Confermata!', 
            text: 'I tuoi dati sono stati salvati correttamente.', 
            confirmButtonColor: '#416900' 
        }).then(() => {
            window.location.reload();
        });
    }
}