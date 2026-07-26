const { Resend } = require('resend');

module.exports = async function handler(req, res) {
    // Permettiamo solo richieste di tipo POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo non consentito' });
    }

    try {
        // Controllo della presenza della chiave API di Resend
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            console.error("❌ Manca la chiave RESEND_API_KEY nelle variabili di Vercel");
            return res.status(500).json({ error: 'Manca la chiave RESEND_API_KEY su Vercel' });
        }

        const resend = new Resend(apiKey);
        
        // EMAIL DELL'UFFICIO CAF CHE RICEVE LE NOTIFICHE
        // (Nota: Durante i test con account gratuito Resend, usa la TUA email di registrazione a Resend)
        const EMAIL_UFFICIO_CAF = 'info@cafuci.it'; 

        const { tipo, nome, email, servizio, telefono, agente, data, ora } = req.body;
        const dataIT = data ? new Date(data).toLocaleDateString('it-IT') : '';

        let emailDestinatario = '';
        let oggettoEmail = '';
        let contenutoHtml = '';

        // 1. NOTIFICA AL CAF PER NUOVA RICHIESTA CLIENTE
        if (tipo === 'NUOVA_RICHIESTA_CAF') {
            emailDestinatario = EMAIL_UFFICIO_CAF;
            oggettoEmail = `🔔 Nuova richiesta prenotazione: ${nome}`;
            contenutoHtml = `
                <h2>Nuova richiesta di appuntamento ricevuta!</h2>
                <p>Un cittadino ha inviato una richiesta di prenotazione dal sito web.</p>
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
        // 2. CONFERMA UFFICIALE AL CLIENTE
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
        // 3. NOTIFICA DI MODIFICA AL CLIENTE
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
            return res.status(400).json({ error: 'Tipo email non riconosciuto' });
        }

        // Invio dell'email tramite Resend
        const response = await resend.emails.send({
            from: 'CAF UCI <onboarding@resend.dev>',
            to: [emailDestinatario],
            subject: oggettoEmail,
            html: contenutoHtml,
        });

        return res.status(200).json({ success: true, data: response });

    } catch (error) {
        console.error("❌ Errore interno Serverless:", error);
        return res.status(500).json({ error: error.message || 'Errore interno del server' });
    }
};