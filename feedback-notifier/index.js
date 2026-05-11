const functions = require("@google-cloud/functions-framework");
const axios = require("axios");
const twilio = require("twilio");

functions.cloudEvent("notifySupport", async (cloudEvent) => {
  // Decode the Pub/Sub message
  console.log("Message Received!");
  const base64Data = cloudEvent.data.message.data;
  const data = JSON.parse(Buffer.from(base64Data, "base64").toString());

  // 1. Slack Integration
  try {
    await axios.post(process.env.SLACK_URL, {
      text: `🚨 *Critical Support Alert*\n*User:* ${data.user}\n*Feedback ID:* ${data.id}\n*OCR Snippet:* _${data.text}_`,
    });
  } catch (e) {
    console.error("Slack failed", e);
  }

  // 2. Twilio SMS Integration
  try {
    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    await client.messages.create({
      body: `ALERT: Critical error in feedback ${data.id}. Snippet: ${data.text.substring(0, 50)}`,
      from: "+18166628453", // Your Twilio Number
      to: "+351925702722", // Your Alert Phone Number
    });
  } catch (e) {
    console.error("Twilio failed", e);
  }
});
