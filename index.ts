const server = Deno.listen({ port: 80 });

const metadataApi = `https://jbx.mypinata.cloud/ipfs`
const graphApi = 'https://api.studio.thegraph.com/query/30654/mainnet-dev/0.5.0'
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
  for await (const requestEvent of httpConn) {
    const res = await fetch(graphApi, {
      body: JSON.stringify({ query }),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    const answer = await res.json();
    
    let body = `<rss xmlns:atom="http://www.w3.org/2005/Atom" version="2.0"><channel>
    <title>Juicebox Projects</title>
    <link>http://juice-rss.deno.dev/</link>
    <description>Latest projects on juicebox.money</description>
    <language>en-us</language>
    <atom:link href="http://juice-rss.deno.dev/" rel="self" type="application/rss+xml"/>`;
    
    for(const { projectId, metadataUri, createdAt, owner } of answer.data.projects){
      const ipfsRes = await fetch(`${metadataApi}/${metadataUri}`);
      const metadata = await ipfsRes.json();
      body += `<item>
      <title>${metadata.name}</title>
      <link>https://juicebox.money/v2/p/${projectId}/</link>
      <description>
        Description: ${metadata.description}&lt;br&gt;&lt;br/&gt;
        Disclosure: ${metadata.payDisclosure}&lt;br/&gt;&lt;br/&gt;
        &lt;a href='https://twitter.com/${metadata.twitter}'&gt;Twitter: @${metadata.twitter} &lt;/a&gt;
        &lt;a href='${metadata.discord}'&gt;Discord: ${metadata.discord}&lt;/a&gt;&lt;br/&gt;
      </description>
      <author>${owner}</author>
      <guid>${projectId}</guid>
      <pubDate>${new Date(createdAt * 1000).toISOString()}</pubDate>
      </item>`
    }

    body += `</channel></rss>`;

    requestEvent.respondWith(
      new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/xml'}
      }),
    );
  }
}
