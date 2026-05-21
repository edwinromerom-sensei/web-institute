export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { correo, resultado } = req.body;
    const response = await fetch(
      'https://api.airtable.com/v0/app66Na9UvIBTvbTx/tblRt5z2tq0edrpYv',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`
        },
        body: JSON.stringify({
          fields: {
            'Correo': correo,
            'Resultado': resultado
          }
        })
      }
    );
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error connecting to Airtable' });
  }
}
