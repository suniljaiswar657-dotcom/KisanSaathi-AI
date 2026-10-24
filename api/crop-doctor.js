export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Sirf POST request allowed hai." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "AI key abhi configure nahi hui. Vercel Settings > Environment Variables mein GEMINI_API_KEY add karke redeploy karein."
    });
  }

  const body = req.body || {};
  const crop = String(body.crop || "").slice(0, 100);
  const problem = String(body.problem || "").slice(0, 200);
  const details = String(body.details || "").slice(0, 1200);

  if (!crop || !problem) {
    return res.status(400).json({ error: "Fasal aur problem select karein." });
  }

  const prompt = [
    "Tum KisanSaathi AI ho, Indian farmers ke liye Hindi/Hinglish farming assistant.",
    "User ke input par cautious, practical initial guidance do; definitive diagnosis ka daawa mat karo.",
    "Agar symptoms se cause confirm nahi hota, possible causes ko possibilities ki tarah batao aur 1-2 useful follow-up checks do.",
    "Pesticide ka exact dose, tank-mix, ya chemical treatment prescribe mat karo. Product label aur local Krishi Vigyan Kendra/agriculture officer se confirmation kehna.",
    "Pehle low-risk checks aur integrated pest management batana. Safety, waterlogging, irrigation, nutrition aur disease ke possibilities ko context ke hisaab se consider karo.",
    "Jawab simple Hindi/Hinglish mein, headings aur short bullet points mein, 120-220 words ke andar do.",
    "Clearly state: yeh AI-generated initial guidance hai, lab-confirmed diagnosis nahi. Agar problem tezi se fail rahi ho, local agriculture expert ko dikhayein.",
    "Crop: " + crop,
    "Selected symptom: " + problem,
    "Farmer's extra details: " + (details || "No extra details supplied.")
  ].join("\n");

  try {
    const upstream = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=" + encodeURIComponent(apiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 500 }
        })
      }
    );

    const data = await upstream.json();
    if (!upstream.ok) {
      console.error("Gemini API returned status", upstream.status);
      return res.status(502).json({
        error: upstream.status === 429
          ? "AI ki free usage limit abhi poori hai. Thodi der baad dobara try karein."
          : "AI service se response nahi mila. API key, model access aur quota check karein."
      });
    }

    const answer = (data.candidates || [])
      .flatMap(candidate => candidate.content && candidate.content.parts ? candidate.content.parts : [])
      .map(part => part.text || "")
      .join("\n")
      .trim();

    if (!answer) {
      return res.status(502).json({ error: "AI se readable jawab nahi mila. Dobara try karein." });
    }

    return res.status(200).json({ answer });
  } catch (error) {
    console.error("Crop Doctor request failed:", error && error.message ? error.message : "unknown error");
    return res.status(500).json({ error: "Connection problem. Internet check karke dobara try karein." });
  }
}
