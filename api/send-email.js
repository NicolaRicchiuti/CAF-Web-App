export default async function handler(req, res) {
    // 1. Permettiamo solo richieste di tipo POST (per sicurezza)
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo non consentito' });
    }

    const { nome, email, servizio, agente, data, ora } = req.body;

    // 2. Controllo di sicurezza sui dati ricevuti
    if (!email || !nome || !servizio || !agente || !data || !ora) {
        return res.status(400).json({ error: 'Dati della prenotazione incompleti' });
    }

    // 3. Recuperiamo la chiave segreta di Resend dalle variabili d'ambiente di Vercel
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
        return res.status(500).json({ error: 'Configurazione server mancante (Chiave API)' });
    }

    try {
        // 4. Chiamata diretta alle API di Resend utilizzando il comando nativo fetch
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`
            },
            body: JSON.stringify({
                from: 'CAF UCI Avellino <prenotazioni@uciavellino.it>',
                to: [email],
                subject: `Conferma Appuntamento: ${servizio}`,
                html: `
                    <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e4e4e7; border-radius: 16px; background-color: #ffffff;">
                        <h2 style="color: #416900; margin-top: 0;">Prenotazione Confermata!</h2>
                        <p style="font-size: 15px; color: #3f3f46;">Gentile <strong>${nome}</strong>,</p>
                        <p style="font-size: 15px; color: #3f3f46; line-height: 1.5;">Ti confermiamo che il tuo appuntamento presso la sede del <strong>CAF UCI Avellino</strong> è stato registrato con successo nei nostri sistemi.</p>
                        
                        <div style="background-color: #f4f4f5; padding: 20px; border-radius: 12px; margin: 24px 0;">
                            <h3 style="margin-top: 0; font-size: 14px; color: #71717a; text-transform: uppercase; letter-spacing: 1px;">Dettagli dell'appuntamento</h3>
                            <p style="margin: 6px 0; font-size: 15px; color: #18181b;"><strong>Servizio:</strong> ${servizio}</p>
                            <p style="margin: 6px 0; font-size: 15px; color: #18181b;"><strong>Consulente:</strong> ${agente}</p>
                            <p style="margin: 6px 0; font-size: 15px; color: #18181b;"><strong>Data:</strong> ${data}</p>
                            <p style="margin: 6px 0; font-size: 15px; color: #18181b;"><strong>Orario:</strong> ore ${ora}</p>
                        </div>

                        <p style="font-size: 12px; color: #a1a1aa; line-height: 1.4; margin-bottom: 0;">Se hai la necessità di disdire o spostare l'appuntamento, ti preghiamo di contattarci rispondendo direttamente a questa email o chiamando il nostro ufficio.</p>
                    </div>
                `
            })
        });

        const dataResend = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: dataResend.message || 'Errore durante l\'invio dell\'email' });
        }

        // Tutto è andato a buon fine!
        return res.status(200).json({ success: true, data: dataResend });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}