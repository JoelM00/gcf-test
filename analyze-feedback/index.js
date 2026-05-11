const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore"); // Import this specifically
const vision = require('@google-cloud/vision');
const { PubSub } = require('@google-cloud/pubsub');

admin.initializeApp({
  projectId: 'joelmartins'
});

const visionClient = new vision.ImageAnnotatorClient();
const pubsub = new PubSub();

exports.analyzeFeedback = async (req, res) => {
    try {
        const feedbackId = (req.headers['ce-subject'] || "").split('/').pop();
        
        if (!feedbackId) {
            console.error("No ID in headers.");
            return res.status(200).send("No ID");
        }

        console.log(`🔔 Doorbell: ${feedbackId}. Waiting for replication...`);
        await new Promise(resolve => setTimeout(resolve, 1500));

        // CORRECT WAY to target 'first-firestore'
        const db = getFirestore('first-firestore'); 
        const docRef = db.collection('user_feedback').doc(feedbackId);
        const snapshot = await docRef.get();

        if (!snapshot.exists) {
            console.error(`❌ Document ${feedbackId} not found in 'first-firestore'.`);
            return res.status(200).send("Not found");
        }

        const data = snapshot.data();
        console.log("✅ SUCCESS! Data retrieved:", JSON.stringify(data));

        const screenshotUri = data.imageUrl;
        if (screenshotUri && screenshotUri.startsWith('gs://')) {
            try {
                const [result] = await visionClient.textDetection(screenshotUri);
                const text = result.fullTextAnnotation?.text || "";
                
                if (text.toLowerCase().includes("error") || data.severity === "high") {
                    await pubsub.topic('critical-alerts').publishMessage({
                        json: { id: feedbackId, user: data.userEmail, text: text.substring(0, 250) }
                    });
                    console.log("🚀 Alert published.");
                }
            } catch (vErr) {
                console.error("Vision Error:", vErr.message);
            }
        }

        res.status(200).send("Finished");

    } catch (err) {
        console.error("Final Error:", err.message);
        res.status(200).send("Handled");
    }
};