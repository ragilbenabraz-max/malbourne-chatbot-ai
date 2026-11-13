const WHATSAPP_TOKEN = "EAAfXRkKFWckBSy5t7Ne16P5ukrwTxCAGiMwVnQcSx8IFEzZBGEFn35CGITqoJjuatslyOmKCBOlIAu5ZAj3fOZBdkHk8ihCZABnoKuPehbutr8GTWTRiP1i6d8Rk33EKQivx7vhY3IbCJBUC2Ksbre9IypybEyaBZC8JZCsjWrLxt0jZC6jDe5FcXZAy9pArofDnDXEFNNcQGZBfQ7yug7DbkxNOZCbftv4hMkrFB4eMNo13VoXNFALSlbxIYsHkvlBCcZAKQgbTma55ZAYZCWkHY6lHV";
const PHONE_NUMBER_ID = "1411391318732549"; // ID nomor uji coba dari Meta
const RECIPIENT_PHONE = "6281249565875";    // Nomor tujuan (tanpa tanda +, spasi, atau strip)

async function sendTestMessage() {
  try {
    const response = await fetch(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: RECIPIENT_PHONE,
        type: "template",
        template: {
          name: "jaspers_market_order_confirm",
          language: { code: "en_US" }
        }
      })
    });

    const data = await response.json();
    console.log('Respon dari Meta:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Terjadi kesalahan:', error);
  }
}

sendTestMessage();