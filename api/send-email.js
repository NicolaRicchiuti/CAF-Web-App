import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// IMPOSTA QUI L'EMAIL DELL'UFFICIO CAF 
// (Nota: Se sei in prova su Resend senza dominio verificato, usa la TUA email con cui ti sei iscritto a Resend)
const EMAIL_UFFICIO_CAF = 'info@cafuci.it'; 

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo non consentito' });
    }

    try {
        // Controllo presenza Chiave API
        if (!process.env.RESEND_API_KEY) {
            return res.status(500).json({ error: 'Manca la variabile RESEND_API_KEY nelle impostazioni di Vercel.' });
        }

        const { tipo, nome, email, servizio, telefono, agente, data, ora } = req.body;
        const dataIT = data ? new Date(data).toLocaleDateString('it-IT') : '';
        
        let emailDestinatario = '';
        let oggettoEmail = '';
        let contenutoHtml = '';

        // 1. TIPO: NOTIFICA AL CAF PER NUOVA RICHIESTA
        if (tipo === 'NUOVA_RICHIESTA_CAF') {
            emailDestinatario = EMAIL_UFFICIO_CAF;
            oggettoEmail = `🔔 Nuova richiesta prenotazione: ${nome}`;
            contenutoHtml = `
                <h2>Nuova richiesta di appuntamento ricevuta!</h2>
                <p>Un cittadino ha inviato una richiesta di prenotazione tramite il sito web.</p>
                <ul>
                    <li><strong>Cliente:</strong> ${nome}</li>
                    <li><strong>Telefono:</strong> ${telefono}</li>
                    <li><strong>Email Cliente:</strong> ${email || 'Non fornita'}</li>
                    <li><strong>Servizio:</strong> ${servizio}</li>
                    <li><strong>Consulente richiesto:</strong> ${agente}</li>
                    <li><strong>Data richiesta:</strong> ${dataIT}</li>
                    <li><strong>Ora richiesta:</strong> ${ora}</li>
                </ul>
                <p>Accedi al pannello amministratore per confermare o modificare l'appuntamento.</p>
            `;
        } 
        // 2. TIPO: CONFERMA UFFICIALE AL CLIENTE
        else if (tipo === 'CONFERMA_CLIENTE') {
            if (!email) return res.status(200).json({ message: 'Nessuna email cliente fornita.' });
            emailDestinatario = email;
            oggettoEmail = `✅ Appuntamento Confermato - CAF UCI`;
            contenutoHtml = `
                <h2>Gentile ${nome},</h2>
                <p>Ti confermiamo che il tuo appuntamento presso la nostra sede è stato <strong>approvato</strong>!</p>
                <h3>Riepilogo Appuntamento</h3>
                <ul>
                    <li><strong>Servizio:</strong> ${servizio}</li>
                    <li><strong>Consulente:</strong> ${agente}</li>
                    <li><strong>Data:</strong> ${dataIT}</li>
                    <li><strong>Ora:</strong> ${ora}</li>
                </ul>
                <p>Ti aspettiamo in sede. Per eventuali comunicazioni puoi contattarci telefonicamente.</p>
            `;
        } 
        // 3. TIPO: NOTIFICA DI MODIFICA/SPOSTAMENTO AL CLIENTE
        else if (tipo === 'MODIFICA_CLIENTE') {
            if (!email) return res.status(200).json({ message: 'Nessuna email cliente fornita.' });
            emailDestinatario = email;
            oggettoEmail = `✏️ Aggiornamento Appuntamento - CAF UCI`;
            contenutoHtml = `
                <h2>Gentile ${nome},</h2>
                <p>Ti informiamo che i dettagli del tuo appuntamento sono stati <strong>aggiornati</strong> dall'ufficio.</p>
                <h3>Nuovi Dettagli Appuntamento</h3>
                <ul>
                    <li><strong>Servizio:</strong> ${servizio}</li>
                    <li><strong>Consulente:</strong> ${agente}</li>
                    <li><strong>Nuova Data:</strong> ${dataIT}</li>
                    <li><strong>Nuovo Orario:</strong> ${ora}</li>
                </ul>
                <p>A presto!</p>
            `;
        } else {
            return res.status(400).json({ error: 'Tipo di email non valido' });
        }

        // Invio tramite Resend API
        const response = await resend.emails.send({
            from: 'CAF UCI <onboarding@resend.dev>',
            to: [emailDestinatario],
            subject: oggettoEmail,
            html: contenutoHtml,
        });

        if (response.error) {
            console.error("❌ ERRORE RESEND:", response.error);
            return res.status(400).json({ error: response.error.message || response.error });
        }

        return res.status(200).json({ success: true, data: response });

    } catch (error) {
        console.error("❌ ERRORE SERVERLESS CATCH:", error);
        return res.status(500).json({ error: error.message || 'Errore interno del server' });
    }
}