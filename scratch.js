import 'dotenv/config';

async function run() {
  try {
    const authRes = await fetch('https://api.pluggy.ai/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: process.env.PLUGGY_CLIENT_ID,
        clientSecret: process.env.PLUGGY_CLIENT_SECRET,
      })
    });
    
    if (!authRes.ok) {
      console.error('Auth failed', await authRes.text());
      return;
    }
    
    const { apiKey } = await authRes.json();
    console.log('Got API Key');
    
    const itemsRes = await fetch('https://api.pluggy.ai/items', {
      headers: { 'X-API-KEY': apiKey }
    });
    const itemsData = await itemsRes.json();
    
    console.log('Total items in Pluggy:', itemsData.results?.length || 0);
    const itemIds = itemsData.results?.map(i => i.id) || [];
    console.log('Item IDs:', itemIds);
    
  } catch (err) {
    console.error(err);
  }
}
run();
