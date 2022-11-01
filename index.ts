const server = Deno.listen({ port: 80 });

// IPFS Gateway
const metadataApi = `https://jbx.mypinata.cloud/ipfs`

// GraphQL API
const graphApi = 'https://api.studio.thegraph.com/query/30654/mainnet-dev/0.5.0'

// GraphQL query
const query = `{
  projects(first: 5, orderBy: createdAt, orderDirection: desc){
    projectId
    metadataUri
    createdAt
    owner
  }
}`;

for await (const conn of server) {
  serveHttp(conn);
}

async function serveHttp(conn: Deno.Conn) {

  const httpConn = Deno.serveHttp(conn);

  // Query GraphQL API
  for await (const requestEvent of httpConn) {
    const res = await fetch(graphApi, {
      body: JSON.stringify({ query }),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    const answer = await res.json();

    // Initialize RSS XML
    let body = `<rss xmlns:atom="http://www.w3.org/2005/Atom" version="2.0"><channel>
    <title>Juicebox Projects</title>
    <link>http://juice-rss.deno.dev/</link>
    <description>Latest projects on juicebox.money</description>
    <language>en-us</language>
    <atom:link href="http://juice-rss.deno.dev/" rel="self" type="application/rss+xml"/>`;
    
    // Add items
    for(const { projectId, metadataUri, createdAt, owner } of answer.data.projects){
      // Fetch IPFS metadata
      const ipfsRes = await fetch(`${metadataApi}/${metadataUri}`);
      const metadata = await ipfsRes.json();

      // Add item
      body += `<item>
      <title>${projectId}: ${metadata.name}</title>
      <link>https://juicebox.money/v2/p/${projectId}/</link>
      <description>`
      if(metadata.description){ body += `Description: ${metadata.description}&lt;br&gt;&lt;br/&gt;`; }
      if(metadata.payDisclosure){ body += `Disclosure: ${metadata.payDisclosure}&lt;br/&gt;&lt;br/&gt;`; }
      if(metadata.twitter){ body += `Twitter: &lt;a href='https://twitter.com/${metadata.twitter}'&gt;@${metadata.twitter} &lt;/a&gt;`; }
      if(metadata.discord){ body += `Discord: &lt;a href='${metadata.discord}'&gt;${metadata.discord}&lt;/a&gt;`; }
      body += `</description>
      <author>${owner}</author>
      <guid>${projectId}</guid>
      <pubDate>${new Date(createdAt * 1000).toISOString()}</pubDate>
      </item>`
    }

    // Close RSS XML
    body += `</channel></rss>`;

    // XML Response
    requestEvent.respondWith(
      new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/xml'}
      }),
    );
  }
}
