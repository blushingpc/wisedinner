import { currentIntegrationHostPOST } from "./current-integration-host.server.ts";
type Route="currentSession"|"currentRead"|"appleCredential"|"deletion";
/** Trusted reverse-proxy transport only. Render must overwrite these forwarded
 * headers. Never derive the approved public origin from an incoming header. */
export function currentNodeHostPOST(route:Route,request:Request):Promise<Response>{
  const expected=process.env.WD_CURRENT_INTEGRATION_HOST_ORIGIN;
  if(expected){
    const url=new URL(request.url);
    let publicUrl:URL|undefined;
    try {const u=new URL(expected);if(u.protocol==="https:"&&!u.port&&!u.username&&!u.password&&u.origin===expected)publicUrl=u;}catch{}
    if(publicUrl&&["http:","https:"].includes(url.protocol)&&
      ["0.0.0.0","127.0.0.1","localhost","[::1]"].includes(url.hostname)&&
      url.port===String(process.env.PORT??3000)&&
      request.headers.get("host")===publicUrl.host&&
      request.headers.get("x-forwarded-host")===publicUrl.host&&
      request.headers.get("x-forwarded-proto")==="https"){
      return currentIntegrationHostPOST(route,new Request(expected+url.pathname+url.search,request));
    }
  }
  // Missing/mismatched/ported metadata stays with the original strict guard.
  return currentIntegrationHostPOST(route,request);
}
