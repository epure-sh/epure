// REST transport remains available when the optional hosted MCP endpoint is disabled.
async function apiRequest(endpoint, token, {method='GET', path, query={}, body, files}={}) {
  if (!token) throw new Error('Authentication required: run epure-mcp login or provide EPURE_TOKEN');
  if (typeof path !== 'string' || !path.startsWith('/api/v1/') || path.includes('\\')) throw new Error('path must start with /api/v1/');
  const base = new URL(endpoint);const url = new URL(path,base);
  if (url.origin !== base.origin) throw new Error('Cross-origin API requests are forbidden');
  method=method.toUpperCase();if (!['GET','POST','PUT','PATCH','DELETE','HEAD'].includes(method)) throw new Error('Unsupported method');
  for (const [key,value] of Object.entries(query)) if(value!=null)url.searchParams.set(key,String(value));
  const headers={Authorization:`Bearer ${token}`};let payload;
  if(files){payload=new FormData();for(const [key,value] of Object.entries(body||{}))payload.append(key,String(value));for(const f of files)payload.append(f.field||'file',new Blob([Buffer.from(f.base64,'base64')],{type:f.contentType||'application/octet-stream'}),f.filename);}
  else if(body!==undefined){headers['Content-Type']='application/json';payload=JSON.stringify(body);}
  const response=await fetch(url,{method,headers,body:payload,redirect:'error',signal:AbortSignal.timeout(30000)});
  const text=await response.text();let data;try{data=JSON.parse(text)}catch{data=text||null}
  if(!response.ok)throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
  return {status:response.status,data};
}
module.exports={apiRequest};
