import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

async function createGoogleJWT(clientEmail: string, privateKey: string): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/calendar.events",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  const base64UrlEncode = (obj: any) => 
    btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const encodedHeader = base64UrlEncode(header);
  const encodedClaim = base64UrlEncode(claim);
  const signatureInput = `${encodedHeader}.${encodedClaim}`;

  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = privateKey.replace(pemHeader, "").replace(pemFooter, "").replace(/\s/g, "");
  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  return `${signatureInput}.${encodedSignature}`;
}

serve(async (req) => {
  try {
    const payload = await req.json();
    const { record, old_record, type } = payload;
    
    console.log(`=== EVENTO RILEVATO: ${type} ===`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const googleEmail = (Deno.env.get("GOOGLE_CLIENT_EMAIL") || "").trim();
    const googleKey = (Deno.env.get("GOOGLE_PRIVATE_KEY") || "").replace(/\\n/g, "\n");
    const calendarId = (Deno.env.get("GOOGLE_CALENDAR_ID") || "").trim();
    const resendKey = Deno.env.get("RESEND_API_KEY") || "";

    const jwtToken = await createGoogleJWT(googleEmail, googleKey);
    const authRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwtToken })
    });
    const authData = await authRes.json();
    const googleAccessToken = authData.access_token;

    // ==========================================
    // CASO A: NUOVA PRENOTAZIONE (INSERT)
    // ==========================================
    if (type === "INSERT") {
      const partiOra = record.ora.split(':');
      const oraPulita = partiOra.length === 2 ? `${record.ora}:00` : record.ora;
      const startDateTime = `${record.data}T${oraPulita}`;
      const endDateObj = new Date(new Date(startDateTime).getTime() + 30 * 60000);
      const endDateTime = endDateObj.toISOString().split('.')[0];

      console.log(`-> Inserimento su Google Calendar...`);
      const calendarRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${googleAccessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: `Appuntamento: ${record.nome_cliente}`,
          description: `Telefono: ${record.telefono}`,
          start: { dateTime: startDateTime, timeZone: "Europe/Rome" },
          end: { dateTime: endDateTime, timeZone: "Europe/Rome" }
        })
      });
      const calendarData = await calendarRes.json();
      
      if (calendarData.id) {
        await supabase.from("appuntamenti").update({ google_event_id: calendarData.id }).eq("id", record.id);
      }

      // 📧 INVIO EMAIL AUTOMATICA CON ALLEGATO .ICS
      if (resendKey && record.email_cliente) {
        console.log(`-> Generazione file di calendario (.ics) per l'email...`);
        const dateRaw = record.data.replace(/-/g, "");
        const timeRaw = oraPulita.replace(/:/g, "");
        
        const icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:Appuntamento CAF UCI\nDTSTART:${dateRaw}T${timeRaw}\nDURATION:PT30M\nDESCRIPTION:Promemoria del tuo appuntamento richiesto al CAF.\nEND:VEVENT\nEND:VCALENDAR`;
        const icsBase64 = btoa(encodeLetteralmente(icsContent));

        console.log(`-> Invio email di conferma a: ${record.email_cliente}`);
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: 'CAF UCI <onboarding@resend.dev>',
            to: record.email_cliente,
            subject: 'Richiesta Ricevuta - CAF UCI',
            html: `<p>Gentile <strong>${record.nome_cliente}</strong>,<br><br>abbiamo ricevuto la tua richiesta di appuntamento per il giorno <strong>${record.data}</strong> alle ore <strong>${record.ora}</strong>.<br>In allegato trovi il promemoria da salvare sul tuo smartphone.</p>`,
            attachments: [{ filename: 'promemoria-caf.ics', content: icsBase64 }]
          })
        });
        console.log("Risposta del server Resend (Status):", emailRes.status);
      }

      return new Response(JSON.stringify({ status: "Calendar ed Email completati" }), { status: 200 });
    }

    // ==========================================
    // CASO B & C: UPDATE E DELETE
    // ==========================================
    if (type === "UPDATE") {
      if (record.google_event_id !== old_record.google_event_id && record.data === old_record.data && record.ora === old_record.ora && record.stato === old_record.stato) {
        return new Response("No-op", { status: 200 });
      }
      const eventId = record.google_event_id;
      if (!eventId) return new Response("Missing ID", { status: 200 });

      if (record.stato === "cancellato" || record.stato === "annullato") {
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${googleAccessToken}` }
        });
        return new Response("Rimosso", { status: 200 });
      }

      const partiOra = record.ora.split(':');
      const oraPulita = partiOra.length === 2 ? `${record.ora}:00` : record.ora;
      const startDateTime = `${record.data}T${oraPulita}`;
      const endDateObj = new Date(new Date(startDateTime).getTime() + 30 * 60000);
      const endDateTime = endDateObj.toISOString().split('.')[0];

      await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${googleAccessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: `Appuntamento: ${record.nome_cliente}`,
          description: `Telefono: ${record.telefono}`,
          start: { dateTime: startDateTime, timeZone: "Europe/Rome" },
          end: { dateTime: endDateTime, timeZone: "Europe/Rome" }
        })
      });
      return new Response("Modificato", { status: 200 });
    }

    if (type === "DELETE") {
      const eventId = old_record?.google_event_id;
      if (eventId) {
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${googleAccessToken}` }
        });
      }
      return new Response("Eliminato", { status: 200 });
    }

    return new Response("No action", { status: 200 });
  } catch (err: any) {
    console.error("🚨 CRASH:", err.message);
    return new Response(err.message, { status: 500 });
  }
});

function encodeLetteralmente(str: string) {
  return Uint8Array.from(str, (c) => c.charCodeAt(0)).reduce((data, byte) => data + String.fromCharCode(byte), '');
}