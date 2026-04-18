export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { actorId, input } = req.body;
  const token = process.env.APIFY_TOKEN;
  if (!token) return res.status(500).json({ error: "APIFY_TOKEN not set" });
  try {
    const r = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=90&memory=256`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }
    );
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}